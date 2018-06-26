import { Injectable } from '@angular/core';

import * as tf from '@tensorflow/tfjs';
import shuffle from 'shuffle-array';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TensorflowImageClassifier {

  learningRate: number = 0.00001;
  hiddenUnits: number = 100;
  epochs: number = 20;
  batchSize: number = 10;

  baseModel: tf.Model;
  headModel: tf.Model;
  labels: string[];

  isTraining: boolean;

  trainingSubject: BehaviorSubject<any>;

  constructor() {
    this.init();
  }

  private async init() {
    this.trainingSubject = new BehaviorSubject<any>('');
    this.baseModel = await this.loadMobilenet();
  }

  public getTrainingObservable() {
    return this.trainingSubject.asObservable();
  }

  public setLabels(labels) {
    this.labels = labels;
  }

  private async loadMobilenet(): Promise<tf.Model> {
    const mobilenet = await tf.loadModel('https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json');

    const layer = mobilenet.getLayer('conv_pw_13_relu');
    return tf.model({ inputs: mobilenet.inputs, outputs: layer.output });
  }

  private precompute(imageData: ImageData): tf.Tensor<tf.Rank> {
    return tf.tidy(() => {
      const image = this.imageDataToTensor(imageData);
      return <tf.Tensor<tf.Rank>>this.baseModel.predict(image);
    });
  }

  private imageDataToTensor(imageData: ImageData): tf.Tensor<tf.Rank> {
    return tf.tidy(() => {
      const faceImage = tf.fromPixels(imageData);
      const batchedImage = faceImage.expandDims(0);

      return batchedImage.toFloat().div(tf.scalar(127)).sub(tf.scalar(1));
    });
  }

  public async trainModel(data) {
    this.isTraining = true;
    const controllerDataset = await this.dataToDataset(data);
    this.labels = controllerDataset.labels;

    let model = this.createHeadModel(this.labels.length);

    const optimizer = tf.train.adam(+this.learningRate);
    model.compile({ optimizer: optimizer, loss: 'categoricalCrossentropy', metrics: ['accuracy'] });

    let epochsCompleted = 0;
    let config: any = {
      batchSize: +this.batchSize,
      epochs: +this.epochs,
      shuffle: true,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: async (_, logs) => {
          epochsCompleted++;

          this.trainingSubject.next({ epochsCompleted, ...logs });
          await tf.nextFrame();
        },
        onTrainEnd: () => {
          this.headModel = model;
          this.isTraining = false;
        }
      }
    }

    return model.fit(controllerDataset.xs, controllerDataset.ys, config);
  }

  private async dataToDataset(data) {
    shuffle(data);

    let labels = data.map(image => image.label);
    labels = Array.from(new Set(labels));

    let ys = [];
    let xs = [];

    // Done with arrays because of memory leak in tf.concat
    for (const image of data) {
      const labelIndex = labels.indexOf(image.label);
      const y = tf.tidy(() => tf.oneHot(tf.tensor1d([labelIndex]).toInt(), labels.length));
      const x = tf.tidy(() => this.precompute(image.imageData));

      ys = ys.concat(Array.from(y.dataSync()));
      xs = xs.concat(Array.from(x.dataSync()));

      x.dispose();
      y.dispose();

      await tf.nextFrame();
    }

    return { labels, xs: tf.tensor(xs, [data.length, 7, 7, 256]), ys: tf.tensor(ys, [data.length, labels.length]) };
  }

  private createHeadModel(labelsNumber) {
    return tf.sequential({
      layers: [
        tf.layers.flatten({ inputShape: [7, 7, 256] }),
        tf.layers.dense({
          units: +this.hiddenUnits,
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

    activations.dispose();
    predictions.dispose();

    return this.labels[pred[0]] + ': ' + Math.floor(prob[0] * 100) + '%';
  }
}
