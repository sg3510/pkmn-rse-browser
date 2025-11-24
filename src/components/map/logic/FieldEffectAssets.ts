const PROJECT_ROOT = '/pokeemerald';
export const ARROW_SPRITE_PATH = `${PROJECT_ROOT}/graphics/field_effects/pics/arrow.png`;

let grassSpriteCache: HTMLCanvasElement | null = null;
let longGrassSpriteCache: HTMLCanvasElement | null = null;
let sandSpriteCache: HTMLCanvasElement | null = null;
let arrowSpriteCache: HTMLCanvasElement | null = null;
let arrowSpritePromise: Promise<HTMLCanvasElement> | null = null;

export function getGrassSprite(): HTMLCanvasElement | null {
  return grassSpriteCache;
}

export function getLongGrassSprite(): HTMLCanvasElement | null {
  return longGrassSpriteCache;
}

export function getSandSprite(): HTMLCanvasElement | null {
  return sandSpriteCache;
}

export function getArrowSprite(): HTMLCanvasElement | null {
  return arrowSpriteCache;
}

export const ensureGrassSprite = async (): Promise<HTMLCanvasElement> => {
  if (grassSpriteCache) {
    return grassSpriteCache;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = `${PROJECT_ROOT}/graphics/field_effects/pics/tall_grass.png`;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get grass sprite context'));
        return;
      }
      ctx.drawImage(img, 0, 0);

      // Make transparent - assume top-left pixel is background
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const bgR = data[0];
      const bgG = data[1];
      const bgB = data[2];

      for (let i = 0; i < data.length; i += 4) {
        if (data[i] === bgR && data[i + 1] === bgG && data[i + 2] === bgB) {
          data[i + 3] = 0; // Alpha 0
        }
      }

      ctx.putImageData(imageData, 0, 0);
      grassSpriteCache = canvas;
      resolve(canvas);
    };
    img.onerror = (err) => reject(err);
  });
};

export const ensureLongGrassSprite = async (): Promise<HTMLCanvasElement> => {
  if (longGrassSpriteCache) {
    return longGrassSpriteCache;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = `${PROJECT_ROOT}/graphics/field_effects/pics/long_grass.png`;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get long grass sprite context'));
        return;
      }
      ctx.drawImage(img, 0, 0);

      // Make transparent - assume top-left pixel is background
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const bgR = data[0];
      const bgG = data[1];
      const bgB = data[2];

      for (let i = 0; i < data.length; i += 4) {
        if (data[i] === bgR && data[i + 1] === bgG && data[i + 2] === bgB) {
          data[i + 3] = 0; // Alpha 0
        }
      }

      ctx.putImageData(imageData, 0, 0);
      longGrassSpriteCache = canvas;
      resolve(canvas);
    };
    img.onerror = (err) => reject(err);
  });
};

export const ensureSandSprite = async (): Promise<HTMLCanvasElement> => {
  if (sandSpriteCache) {
    return sandSpriteCache;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = `${PROJECT_ROOT}/graphics/field_effects/pics/sand_footprints.png`;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get sand sprite context'));
        return;
      }
      ctx.drawImage(img, 0, 0);

      // Make transparent - assume top-left pixel is background
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const bgR = data[0];
      const bgG = data[1];
      const bgB = data[2];

      for (let i = 0; i < data.length; i += 4) {
        if (data[i] === bgR && data[i + 1] === bgG && data[i + 2] === bgB) {
          data[i + 3] = 0; // Alpha 0
        }
      }

      ctx.putImageData(imageData, 0, 0);
      sandSpriteCache = canvas;
      resolve(canvas);
    };
    img.onerror = (err) => reject(err);
  });
};

export const ensureArrowSprite = async (): Promise<HTMLCanvasElement> => {
  if (arrowSpriteCache) {
    return arrowSpriteCache as HTMLCanvasElement;
  }
  if (arrowSpritePromise) {
    return arrowSpritePromise as Promise<HTMLCanvasElement>;
  }

  arrowSpritePromise = new Promise((resolve, reject) => {
    const img = new Image();
    img.src = ARROW_SPRITE_PATH;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get arrow sprite context'));
        return;
      }
      ctx.drawImage(img, 0, 0);

      // Make transparent - assume top-left pixel is background
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const bgR = data[0];
      const bgG = data[1];
      const bgB = data[2];

      for (let i = 0; i < data.length; i += 4) {
        if (data[i] === bgR && data[i + 1] === bgG && data[i + 2] === bgB) {
          data[i + 3] = 0; // Alpha 0
        }
      }

      ctx.putImageData(imageData, 0, 0);
      arrowSpriteCache = canvas;
      resolve(canvas);
    };
    img.onerror = (err) => {
      console.error('Failed to load arrow sprite', err);
      // Create fallback colored rect
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)'; // Semi-transparent red for debugging
        ctx.fillRect(0, 0, 32, 32);
      }
      arrowSpriteCache = canvas;
      resolve(canvas);
    };
  });
  return arrowSpritePromise as Promise<HTMLCanvasElement>;
};

