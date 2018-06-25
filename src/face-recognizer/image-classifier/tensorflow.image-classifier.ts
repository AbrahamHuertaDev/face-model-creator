import { Injectable } from '@angular/core';

import * as tf from '@tensorflow/tfjs';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TensorflowImageClassifier {

  learningRate: number = 0.00001;
  hiddenUnits: number = 100;
  epochs: number = 20;
  batchSize: number = 10;
  loss: number;

  baseModel: tf.Model;
  headModel: tf.Model;
  labels: string[];

  isTraining: boolean;

  trainingSubject: BehaviorSubject<string>;

  constructor() {
    this.init();
  }

  private async init() {
    this.trainingSubject = new BehaviorSubject<string>('');
    this.baseModel = await this.loadMobilenet();
  }

  public getTrainingObservable() {
    return this.trainingSubject.asObservable();
  }

  private async loadMobilenet(): Promise<tf.Model> {
    const mobilenet = await tf.loadModel('https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json');

    const layer = mobilenet.getLayer('conv_pw_13_relu');
    return tf.model({ inputs: mobilenet.inputs, outputs: layer.output });
  }

  private precompute(imageData: ImageData): tf.Tensor<tf.Rank> {
    const image = this.imageDataToTensor(imageData);
    return <tf.Tensor<tf.Rank>>this.baseModel.predict(image);
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

    let epochsCompleted = 0;
    let callbacks: any = {
      batchSize: this.batchSize,
      epochs: this.epochs,
      callbacks: {
        onBatchEnd: async (batch, logs) => {
          if(logs.batch === 0){
            epochsCompleted++;
          }

          this.loss = logs.loss;
          this.trainingSubject.next(`Epoch ${epochsCompleted}/${this.epochs} - Loss: ${ this.loss.toFixed(5) }`);
          await tf.nextFrame();
        },
        onTrainEnd: () => {
          this.trainingSubject.next(`Final Loss: ${ this.loss.toFixed(5) }`);
          this.headModel = model;
          this.isTraining = false;
        }
      }
    }

    return model.fit(controllerDataset.xs, controllerDataset.ys, callbacks);
  }

  private dataToDataset(data) {
    const labels = Object.keys(data);

    let ys;
    let xs;

    labels.forEach((label, labelIndex) => {
      this.trainingSubject.next(`Precomputing label: ${label}`);
      data[label].forEach((image, imageIndex) => {
        const y = tf.tidy(() => tf.oneHot(tf.tensor1d([labelIndex]).toInt(), labels.length));
        const x = this.precompute(image);

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

  public async loadHeadModel(modelData, weights) {
    this.headModel = await tf.loadModel(tf.io.browserFiles([modelData, weights]));
  }

  public exportModel(): Promise<tf.io.SaveResult> {
    return this.headModel.save('downloads://model');
  }

  public async predict(imageData) {
    if (!this.headModel) {
      return '????';
    }

    const activations = this.precompute(imageData);
    const predictions = <tf.Tensor<tf.Rank>>this.headModel.predict(activations);

    const pred = await predictions.as1D().argMax().data();
    const prob = await predictions.as1D().max().data();

    return this.labels[pred[0]] + ': ' + Math.floor(prob[0] * 100) + '%';
  }
}
