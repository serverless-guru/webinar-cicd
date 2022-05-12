import { Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CodepipelineCdkStackProps } from '../bin/codepipeline-cdk';
import createDevStack from './dev-stack';
import createProdStack from './prod-stack';
export class CodepipelineCdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: CodepipelineCdkStackProps) {
    super(scope, id, props);
    switch (props?.stage) {
      case 'dev':
        createDevStack(this, props);
        break;
      case 'prod':
        createProdStack(this, props);
        break;
      default:
        throw new Error(`Unknown stage: ${props?.stage}`);
    }
  }
}
