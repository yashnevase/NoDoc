import {
  GlobalWorkerOptions,
  TextLayer,
  getDocument,
} from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export { TextLayer, getDocument };
