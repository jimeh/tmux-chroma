function channel(color: string, index: number): number {
  return parseInt(color.slice(index, index + 2), 16);
}

function hex(value: number): string {
  return Math.floor(value).toString(16).padStart(2, '0');
}

export function colorHue(color: string): number {
  const red = channel(color, 1) / 255;
  const green = channel(color, 3) / 255;
  const blue = channel(color, 5) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta === 0) {
    return hue;
  }
  if (max === red) {
    hue = ((green - blue) / delta) % 6;
  } else if (max === green) {
    hue = (blue - red) / delta + 2;
  } else {
    hue = (red - green) / delta + 4;
  }
  return (hue * 60 + 360) % 360;
}

export function normalizeHex(value: string): string {
  const candidate = value.trim().replace(/^#?/, '#');
  return /^#[0-9a-f]{6}$/i.test(candidate)
    ? candidate.toLowerCase()
    : '';
}

export function mixColor(
  first: string,
  second: string,
  percent: number
): string {
  return '#' + [1, 3, 5].map((index) => {
    const value = (
      channel(first, index) * percent +
      channel(second, index) * (100 - percent)
    ) / 100;
    return hex(value);
  }).join('');
}
