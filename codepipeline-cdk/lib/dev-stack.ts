import { Construct } from "constructs";
import { Pipeline, Artifact } from 'aws-cdk-lib/aws-codepipeline';
import { GitHubSourceAction, GitHubTrigger, CodeBuildAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { SecretValue, RemovalPolicy } from "aws-cdk-lib";
import { Project, BuildSpec, LinuxBuildImage } from 'aws-cdk-lib/aws-codebuild';
import { CodepipelineCdkStackProps } from "../bin/codepipeline-cdk";
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Role, ServicePrincipal, ManagedPolicy, PolicyStatement } from 'aws-cdk-lib/aws-iam';

export default function createDevStack(scope: Construct, props: CodepipelineCdkStackProps) {
  
  const bucketName = 'sam-cicd-demo-bucket-be60f114-0e5d-4361-a7f4-e32faac185fc';
  new Bucket(scope, 'DeploymentBucket', {
    bucketName,
    publicReadAccess: false,
    removalPolicy: RemovalPolicy.DESTROY,
    blockPublicAccess: {
      restrictPublicBuckets: true,
      blockPublicAcls: true,
      ignorePublicAcls: true,
      blockPublicPolicy: true
    }
  });

  const pipeline = new Pipeline(scope, 'SamDevPipeline', {
    pipelineName: 'deploy-sam-application-dev',
  });

  const sourceStage = pipeline.addStage({
    stageName: 'Source'
  });
  
  const testDevStage = pipeline.addStage({
    stageName: 'UnitTestDev',
    placement: {
      justAfter: sourceStage
    }
  });

  const deployDevStage = pipeline.addStage({
    stageName: 'DeployToDev',
    placement: {
      justAfter: testDevStage
    }
  });

  const sourceDevOutput = new Artifact();

  const sourceDevAction = new GitHubSourceAction({
    actionName: 'GitHubDevelopBranch',
    owner: 'serverless-guru',
    repo: 'webinar-cicd',
    oauthToken: SecretValue.secretsManager('webinar-cicd-pipeline-example'),
    output: sourceDevOutput,
    branch: 'develop', 
    trigger: GitHubTrigger.POLL
  });

  const testDev = new Project(scope, 'CodeBuildTestDevProject', {
    projectName: 'CodeBuildTestDevProject',
    environment: {
      buildImage: LinuxBuildImage.STANDARD_5_0,
    },
    buildSpec: BuildSpec.fromObject({
      "version": 0.2,
      "phases": {
        "install": {
          "runtime-versions": {
            "nodejs": 14
          },
          "commands": [
            "echo installing dependencies",
            "npm i",
            "pip install --user aws-sam-cli"
          ]
        },
        "build": {
          "commands": [
            "npm run test"
          ]
        },
        "post_build": {
          "commands": [
            "echo BUILD COMPLETED ON `date`",
          ]
        }
      }
    })
  });

  const testDevAction = new CodeBuildAction({
    actionName: 'TestDev',
    project: testDev,
    input: sourceDevOutput
  });

  const deployDev = new Project(scope, 'CodeBuildDevProject', {
    projectName: 'CodeBuildDevProject',
    environment: {
      buildImage: LinuxBuildImage.STANDARD_5_0,
    },
    buildSpec: BuildSpec.fromObject({
      "version": 0.2,
      "phases": {
        "install": {
          "runtime-versions": {
            "nodejs": 14
          },
          "commands": [
            "echo installing dependencies",
            "npm i",
            "pip install --user aws-sam-cli"
          ]
        },
        "build": {
          "commands": [
            "echo Build STARTED on `date`",
            "echo Building sam-app",
            "sam build",
            "echo Build COMPLETED on `date`",
            "echo Deploying sam-app",
            `sam deploy --no-confirm-changeset --no-fail-on-empty-changeset --stack-name sam-cicd-demo-dev --s3-bucket ${bucketName} --capabilities CAPABILITY_IAM --region us-east-1`
          ]
        },
        "post_build": {
          "commands": [
            "echo BUILD COMPLETED ON `date`",
          ]
        }
      }
    })
  });
  
  const deployPolicy = new PolicyStatement();
  deployPolicy.addActions(
    "cloudformation:GetTemplate",
    "cloudformation:CreateChangeSet",
    "cloudformation:DescribeChangeSet",
    "cloudformation:ExecuteChangeSet",
    "cloudformation:DescribeStackEvents",
    "cloudformation:DeleteChangeSet",
    "cloudformation:DescribeStacks",
    "cloudformation:GetTemplateSummary",
    "s3:*Object",
    "s3:ListBucket",
    "s3:getBucketLocation",
    "lambda:UpdateFunctionCode",
    "lambda:GetFunction",
    "lambda:CreateFunction",
    "lambda:DeleteFunction",
    "lambda:GetFunctionConfiguration",
    "lambda:AddPermission",
    "lambda:RemovePermission",
    "dynamodb:CreateTable",
    "dynamodb:UpdateTable",
    "dynamodb:DescribeTable",
    "dynamodb:DeleteTable",
    "apigateway:GET",
    "apigateway:DELETE",
    "apigateway:PUT",
    "apigateway:POST",
    "apigateway:PATCH",
    "iam:GetRole",
    "iam:GetRolePolicy",
    "iam:PassRole",
    "iam:CreateRole",
    "iam:PutRolePolicy",
    "iam:DeleteRole",
    "iam:DeleteRolePolicy",
    "iam:AttachRolePolicy",
    "iam:DetachRolePolicy",
    "iam:PutRolePolicy"
  );

  deployPolicy.addResources(
    `arn:aws:s3:::${bucketName}/*`,
    `arn:aws:s3:::${bucketName}`,
    `arn:aws:apigateway:us-east-1::/restapis`,
    `arn:aws:apigateway:us-east-1::/restapis/*`,
    `arn:aws:lambda:us-east-1:${props?.env?.account}:function:sam-cicd-demo*`,
    `arn:aws:dynamodb:us-east-1:${props?.env?.account}:table/sam-cicd-demo*`,
    `arn:aws:cloudformation:us-east-1:${props?.env?.account}:stack/sam-cicd-demo/*`,
    `arn:aws:cloudformation:us-east-1:${props?.env?.account}:stack/sam-cicd-demo*`,
    `arn:aws:cloudformation:us-east-1:aws:transform/Serverless-2016-10-31`,
    `arn:aws:iam::${props?.env?.account}:role/sam-cicd-demo-*`
  );

  deployDev.addToRolePolicy(deployPolicy);
  const buildDevAction = new CodeBuildAction({
    actionName: 'DeployDev',
    input: sourceDevOutput,
    project: deployDev
  });

  sourceStage.addAction(sourceDevAction);
  testDevStage.addAction(testDevAction);
  deployDevStage.addAction(buildDevAction);

}