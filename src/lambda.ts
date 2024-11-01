import { S3 } from 'aws-sdk';
import { Context } from 'aws-lambda';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);

const s3 = new S3({
  endpoint: 'http://localhost:9000',
  accessKeyId: 'user',        
  secretAccessKey: 'password',  
  s3ForcePathStyle: true,
});

interface AudioDownloadEvent {
  bucket: string;
  key: string;
  coverImageKey: string;
  episodeId: string;
}

// Função para notificar o status do processamento
async function notifyProcessingStatus(episodeId: string, status: 'completed' | 'failed') {
  const apiBaseUrl = process.env.API_BASE_URL;

  if (!apiBaseUrl) {
    throw new Error('API_BASE_URL is not defined in the .env file.');
  }

  const url = `${apiBaseUrl}/api/episodes/${episodeId}`;

  try {
    await axios.post(url, { status });
    console.log(`Notification sent to ${url} with status: ${status}`);
  } catch (error) {
    console.error(`Failed to send notification: ${error}`);
  }
}

export const handler = async (
  event: AudioDownloadEvent,
  context: Context
): Promise<{ success: boolean; data?: string; error?: string }> => {
  try {
    const { bucket, key, coverImageKey, episodeId } = event;

    if (!bucket || !key || !coverImageKey || !episodeId) {
      throw new Error('Bucket, key, cover image key, or episode ID is missing.');
    }

    
    const audioData = await s3.getObject({
      Bucket: bucket,
      Key: key,
    }).promise();

    const coverImageData = await s3.getObject({
      Bucket: bucket,
      Key: coverImageKey,
    }).promise();

    const inputAudioPath = path.join('/tmp', key);
    const coverImagePath = path.join('/tmp', coverImageKey);
    const outputAudioPath = path.join('/tmp', `compressed_${path.basename(key)}`);


    fs.writeFileSync(inputAudioPath, audioData.Body as Buffer);
    fs.writeFileSync(coverImagePath, coverImageData.Body as Buffer);


    await execAsync(`ffmpeg -i ${inputAudioPath} -i ${coverImagePath} -map 0 -map 1 -c:v copy -c:a aac -b:a 192k -metadata:s:v title="Podcast cover" -metadata:s:v comment="Cover image" ${outputAudioPath}`);

    await s3.putObject({
      Bucket: bucket,
      Key: key,
      Body: fs.createReadStream(outputAudioPath),
    }).promise();

    await notifyProcessingStatus(episodeId, 'completed');

    return {
      success: true,
      data: `File successfully replaced: ${key}`,
    };
  } catch (error) {
    console.error(`Error processing audio: ${error}`);

    await notifyProcessingStatus(event.episodeId, 'failed');

    return {
      success: false,
      error: `Failed to process audio: ${(error as Error).message}`,
    };
  }
};
