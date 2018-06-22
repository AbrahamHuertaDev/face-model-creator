export interface FaceDetector {
  init(): void;
  detect(drawable): Promise<Face[]>;
}

export interface Face {
  x: number;
  y: number;
  width: number;
  height: number;
}