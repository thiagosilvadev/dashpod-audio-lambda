import * as cdk from 'aws-cdk-lib';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as lambda from "aws-cdk-lib/aws-lambda";
import path = require('path');
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class AudioLambdaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    const ffmpegLayer = new lambda.LayerVersion(this, 'FFmpegLayer', {
      code:lambda.Code.fromAsset(__dirname, {
          bundling: {
            image: lambda.Runtime.NODEJS_20_X.bundlingImage,
            command: [
              'bash', '-c',
              [
              'cd /',
              'dnf install wget -y',
              'wget https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz',
              'wget https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz.md5',
              'md5sum -c ffmpeg-release-amd64-static.tar.xz.md5',
              'tar xvf ffmpeg-release-amd64-static.tar.xz',
              'mkdir -p ffmpeg/bin',
              'cp ffmpeg-7.0.2-amd64-static/ffmpeg ffmpeg/bin/',
              'cp ffmpeg-7.0.2-amd64-static/ffprobe ffmpeg/bin/',
              'cd ffmpeg',
              'zip -r ../ffmpeg.zip .',
              'cp ../ffmpeg.zip /asset-output'
              ].join(' && ')
            ],
            user: 'root', 
          },
        }),
      compatibleArchitectures: [lambda.Architecture.X86_64],
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: 'A Lambda Layer with FFmpeg for video processing',
    });

    const nodeJsFunctionProps: NodejsFunctionProps = {
      bundling: {
        externalModules: [
          "aws-sdk", // Use the 'aws-sdk' available in the Lambda runtime
        ],
      },
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(120), // Api Gateway timeout
    };

    const audioFn = new NodejsFunction(this, "dashpod-audio", {
      entry: path.join(__dirname, "../src", "lambda.ts"),
      ...nodeJsFunctionProps,
      functionName: "dashpod-audio",
      layers: [ffmpegLayer]
    });
  }
}