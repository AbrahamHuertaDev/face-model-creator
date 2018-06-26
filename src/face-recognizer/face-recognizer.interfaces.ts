export interface FaceDetector {
  init(): Promise<any>;
  detect(drawable): Promise<Face[]>;
}

export interface Face {
  x: number;
  y: number;
  width: number;
  height: number;
}