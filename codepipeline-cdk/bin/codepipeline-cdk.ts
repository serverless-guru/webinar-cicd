#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CodepipelineCdkStack } from '../lib/codepipeline-cdk-stack';
import { StackProps } from 'aws-cdk-lib';
export interface CodepipelineCdkStackProps extends StackProps {
  stage: string;
}

const app = new cdk.App();

new CodepipelineCdkStack(app, 'CodepipelineCdkStackDev', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' },
  stage: 'dev',
});

new CodepipelineCdkStack(app, 'CodepipelineCdkStackProd', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' },
  stage: 'prod',
});