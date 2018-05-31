import { Injectable } from '@angular/core';

import * as tf from '@tensorflow/tfjs';

@Injectable()
export class ImageClassifier {

  learningRate: number = 0.00001;
  hiddenUnits: number = 100;
  epochs: number = 20;
  batchSize: number = 10;
  loss: number = 0;

  mobilenet: tf.Model;
  headModel: tf.Model;
  labels: string[];

  isTraining: boolean;

  constructor() {
    this.init();
  }

  private async init() {
    this.mobilenet = await this.loadMobilenet();
  }

  private async loadMobilenet(): Promise<tf.Model> {
    const mobilenet = await tf.loadModel('https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json');

    const layer = mobilenet.getLayer('conv_pw_13_relu');
    return tf.model({ inputs: mobilenet.inputs, outputs: layer.output });
  }

  public predictMobilenet(imageData: ImageData): tf.Tensor<tf.Rank> {
    const image = this.imageDataToTensor(imageData);
    return <tf.Tensor<tf.Rank>>this.mobilenet.predict(image);
  }

  private imageDataToTensor(imageData: ImageData): tf.Tensor<tf.Rank> {
    return tf.tidy(() => {
      const faceImage = tf.fromPixels(imageData);
      const batchedImage = faceImage.expandDims(0);

      return batchedImage.toFloat().div(tf.scalar(127)).sub(tf.scalar(1));
    });
  }

  public trainModel(data) {
    this.isTraining = true;
    const controllerDataset = this.dataToDataset(data);
    this.labels = controllerDataset.labels;

    let model = this.createHeadModel(this.labels.length);

    const optimizer = tf.train.adam(this.learningRate);
    model.compile({ optimizer: optimizer, loss: 'categoricalCrossentropy' });

    let callbacks: any = {
      batchSize: this.batchSize,
      epochs: this.epochs,
      callbacks: {
        onBatchEnd: async (batch, logs) => {
          this.loss = logs.loss;
          await tf.nextFrame();
        },
        onTrainEnd: () => {
          this.headModel = model;
          this.isTraining = false;
        }
      }
    }

    model.fit(controllerDataset.xs, controllerDataset.ys, callbacks);
  }

  private dataToDataset(data) {
    const labels = Object.keys(data);

    let ys;
    let xs;

    labels.forEach((label, index) => {
      data[label].forEach(image => {
        const y = tf.tidy(() => tf.oneHot(tf.tensor1d([index]).toInt(), labels.length));
        const x = this.predictMobilenet(image);

        if (!ys) {
          ys = tf.keep(y);
          xs = tf.keep(x);
        } else {
          const oldY = ys;
          ys = tf.keep(oldY.concat(y, 0));

          const oldX = xs;
          xs = tf.keep(oldX.concat(x, 0));

          oldY.dispose();
          oldX.dispose();
        }
      });
    });

    return { labels, xs, ys }
  }

  private createHeadModel(labelsNumber) {
    return tf.sequential({
      layers: [
        tf.layers.flatten({ inputShape: [7, 7, 256] }),
        tf.layers.dense({
          units: this.hiddenUnits,
          activation: 'relu',
          kernelInitializer: 'varianceScaling',
          useBias: true
        }),

        tf.layers.dense({
          units: labelsNumber,
          kernelInitializer: 'varianceScaling',
          useBias: false,
          activation: 'softmax'
        })
      ]
    });
  }

  public async predict(imageData) {
    if (!this.headModel) {
      return '????';
    }

    const image = this.imageDataToTensor(imageData)

    const activations = this.mobilenet.predict(image);
    const predictions = <tf.Tensor<tf.Rank>>this.headModel.predict(activations);

    const pred = await predictions.as1D().argMax().data();
    return this.labels[pred[0]];
  }
}
