/**
 * Slices a base64 image (Master Sheet) into a grid of smaller base64 images.
 * Assumes the grid is evenly distributed.
 * 
 * @param base64Image The source image in base64 format.
 * @param rows Number of rows in the grid (default 3).
 * @param cols Number of columns in the grid (default 4).
 * @returns Promise<string[]> Array of 12 base64 images in order (Row 1, then Row 2...).
 */
export const sliceMasterSheet = async (
  base64Image: string,
  rows: number = 3,
  cols: number = 4
): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Enable CORS if needed, though usually base64 is local data
    img.crossOrigin = "Anonymous";

    img.onload = () => {
      const pieces: string[] = [];
      
      const pieceWidth = Math.floor(img.width / cols);
      const pieceHeight = Math.floor(img.height / rows);

      // Crop margin to avoid grid lines (approx 1.5% from edges)
      // This ensures we get the content inside the box, not the black borders
      const marginX = Math.floor(pieceWidth * 0.015);
      const marginY = Math.floor(pieceHeight * 0.015);
      const sourceW = pieceWidth - (marginX * 2);
      const sourceH = pieceHeight - (marginY * 2);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const canvas = document.createElement('canvas');
          canvas.width = pieceWidth;
          canvas.height = pieceHeight;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error("Failed to get canvas context for slicing."));
            return;
          }

          // Draw the specific section with cropping
          ctx.drawImage(
            img,
            (c * pieceWidth) + marginX,   // source x + margin
            (r * pieceHeight) + marginY,  // source y + margin
            sourceW,        // source width (cropped)
            sourceH,        // source height (cropped)
            0,              // dest x
            0,              // dest y
            pieceWidth,     // dest width (stretch back to fill or keep ratio)
            pieceHeight     // dest height
          );

          // Convert back to base64
          try {
             const slicedData = canvas.toDataURL('image/png');
             pieces.push(slicedData);
          } catch (e) {
             console.error("Canvas toDataURL failed", e);
             reject(e);
             return;
          }
        }
      }
      resolve(pieces);
    };

    img.onerror = (e) => {
      reject(new Error("Failed to load Master Sheet image for slicing."));
    };

    img.src = base64Image;
  });
};