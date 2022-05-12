import { Construct } from "constructs";
import { Pipeline, Artifact } from 'aws-cdk-lib/aws-codepipeline';
import { GitHubSourceAction, GitHubTrigger, CodeBuildAction, ManualApprovalAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { SecretValue } from "aws-cdk-lib";
import { Project, BuildSpec } from 'aws-cdk-lib/aws-codebuild';
import { Role } from "aws-cdk-lib/aws-iam";
import { CodepipelineCdkStackProps } from "../bin/codepipeline-cdk";

export default function createProdStack(scope: Construct, props: CodepipelineCdkStackProps) {

  const pipeline = new Pipeline(scope, 'SamProdPipeline', {
    pipelineName: 'deploy-sam-application-prod',
  });

  const sourceStage = pipeline.addStage({
    stageName: 'Source'
  });

  const testProdStage = pipeline.addStage({
    stageName: 'UnitTestProd',
    placement: {
      justAfter: sourceStage
    }
  });

  const approveStage = pipeline.addStage({ 
    stageName: 'Approve',
    placement: {
      justAfter: testProdStage
    }
  });

  const manualApprovalAction = new ManualApprovalAction({
    actionName: 'ApproveAction',
  });

  const deployProdStage = pipeline.addStage({
    stageName: 'DeployToProd',
    placement: {
      justAfter: approveStage
    }
  });

  const sourceProdOutput = new Artifact();

  const sourceProdAction = new GitHubSourceAction({
    actionName: 'GitHubMainBranch',
    owner: 'serverless-guru',
    repo: 'webinar-cicd',
    oauthToken: SecretValue.secretsManager('webinar-cicd-pipeline-example'),
    output: sourceProdOutput,
    branch: 'main', 
    trigger: GitHubTrigger.POLL,      
  });
  
  const testProd = new Project(scope, 'CodeBuildTestProdProject', {
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

  const testProdAction = new CodeBuildAction({
    actionName: 'TestProd',
    project: testProd,
    input: sourceProdOutput
  });
    
  const deployProd = new Project(scope, 'CodeBuildProdProject', {
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
            "pip install --user aws-sam-cli",
            "sam --version"            
          ]
        },
        "build": {
          "commands": [
            "echo Build STARTED on `date`",
            "echo Building sam-app",
            "sam build --use-container",
            "echo Build COMPLETED on `date`",
            "echo Deploying sam-app",
            "sam deploy --no-confirm-changeset --no-fail-on-empty-changeset --stack-name sam-cicd-demo-prod --s3-bucket sam-cicd-demo-bucket-us-east-1-pipeline --capabilities CAPABILITY_IAM --region us-east-1"
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

  const buildProdAction = new CodeBuildAction({
    actionName: 'BuildProd',
    input: sourceProdOutput,
    project: deployProd
  });

  sourceStage.addAction(sourceProdAction);
  testProdStage.addAction(testProdAction);
  approveStage.addAction(manualApprovalAction);
  deployProdStage.addAction(buildProdAction);

  const role = Role.fromRoleArn(scope, 'Role', 'arn:aws:iam::aws:policy/AdministratorAccess');
  manualApprovalAction.grantManualApproval(role);
}

  


