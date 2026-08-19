import { useEffect, useRef, useState } from "react";

import { previewPdfPage } from "../api";

export function LazyThumbImage({
  previewSessionId,
  pageNumber,
  fallbackImage,
  altText,
  className = "",
  scale = 0.55,
}) {
  const thumbRef = useRef(null);
  const [image, setImage] = useState(fallbackImage || "");

  useEffect(() => {
    setImage(fallbackImage || "");
  }, [fallbackImage, pageNumber, scale]);

  useEffect(() => {
    if (!previewSessionId) {
      return undefined;
    }

    let mounted = true;
    void previewPdfPage(previewSessionId, pageNumber, { scale })
      .then((response) => {
        if (mounted) {
          setImage(response.page.image || "");
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [pageNumber, previewSessionId, scale]);

  return (
    <img
      ref={thumbRef}
      className={className}
      src={image || "about:blank"}
      alt={altText}
      draggable="false"
      style={{ visibility: image ? "visible" : "hidden" }}
    />
  );
}
