import { Injectable } from '@angular/core';

import * as tf from '@tensorflow/tfjs';

@Injectable()
export class ImageClassifier {

  learningRate: number = 0.00001;
  hiddenUnits: number = 100;
  epochs: number = 20;
  batchSize: number = 10;

  mobilenet: tf.Model;

  constructor() {
    this.init();
  }

  async init() {
    this.mobilenet = await this.loadMobilenet();
  }

  async loadMobilenet() : Promise<tf.Model> {
    const mobilenet = await tf.loadModel('https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json');

    const layer = mobilenet.getLayer('conv_pw_13_relu');
    return tf.model({ inputs: mobilenet.inputs, outputs: layer.output });
  }

  public predictMobilenet(imageData: ImageData) : tf.Tensor<tf.Rank> {
    const image = this.imageDataToTensor(imageData);
    return <tf.Tensor<tf.Rank>> this.mobilenet.predict(image);
  }

  private imageDataToTensor(imageData: ImageData): tf.Tensor<tf.Rank> {
    return tf.tidy(() => {
      const faceImage = tf.fromPixels(imageData);
      const batchedImage = faceImage.expandDims(0);

      return batchedImage.toFloat().div(tf.scalar(127)).sub(tf.scalar(1));
    });
  }
}
