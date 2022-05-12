import { Construct } from "constructs";
import { Pipeline, Artifact } from 'aws-cdk-lib/aws-codepipeline';
import { GitHubSourceAction, GitHubTrigger, CodeBuildAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { SecretValue } from "aws-cdk-lib";
import { Project, BuildSpec, LinuxBuildImage } from 'aws-cdk-lib/aws-codebuild';
import { CodepipelineCdkStackProps } from "../bin/codepipeline-cdk";

export default function createDevStack(scope: Construct, props: CodepipelineCdkStackProps) {
  
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
            "sam build --use-container",
            "echo Build COMPLETED on `date`",
            "echo Deploying sam-app",
            "sam deploy --no-confirm-changeset --no-fail-on-empty-changeset --stack-name sam-cicd-demo-dev --s3-bucket sam-cicd-demo-bucket-us-east-1-pipeline --capabilities CAPABILITY_IAM --region us-east-1"
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
  
  const buildDevAction = new CodeBuildAction({
    actionName: 'BuildDev',
    input: sourceDevOutput,
    project: deployDev
  });

  sourceStage.addAction(sourceDevAction);
  testDevStage.addAction(testDevAction);
  deployDevStage.addAction(buildDevAction);

}