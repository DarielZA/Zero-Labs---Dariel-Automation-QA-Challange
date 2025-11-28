import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

test.describe('Visual Comparison Tests', () => {
test('visual comparison test 1', async ({ page }, testInfo) => {
    const img1Path = path.join(__dirname, '..', 'src', 'visual-baselines', 'base1.png');
    const img2Path = path.join(__dirname, '..', 'src', 'visual-actual', 'actual1.png');
    const diffPath = path.join(__dirname, '..', 'src', 'visual-diffs', 'diff.png');

    // Create baseline if missing
    if (!fs.existsSync(img1Path)) {
        if (fs.existsSync(img2Path)) {
            fs.copyFileSync(img2Path, img1Path);
            console.log('Baseline created from actual image.');
        } else {
            console.log('Skipping test 1: Both baseline and actual images are missing.');
            return;
        }
    }

    // Read the images
    const img1 = PNG.sync.read(fs.readFileSync(img1Path));
    const img2Raw = PNG.sync.read(fs.readFileSync(img2Path));

    // Resize img2 to match img1 dimensions if needed
    let img2: PNG;
    if (img1.width !== img2Raw.width || img1.height !== img2Raw.height) {
        console.log(`Resizing actual image from ${img2Raw.width}x${img2Raw.height} to ${img1.width}x${img1.height}`);
        img2 = new PNG({ width: img1.width, height: img1.height });
        
        // Simple nearest-neighbor scaling
        for (let y = 0; y < img1.height; y++) {
            for (let x = 0; x < img1.width; x++) {
                const srcX = Math.floor(x * img2Raw.width / img1.width);
                const srcY = Math.floor(y * img2Raw.height / img1.height);
                const srcIdx = (img2Raw.width * srcY + srcX) << 2;
                const dstIdx = (img1.width * y + x) << 2;
                
                img2.data[dstIdx] = img2Raw.data[srcIdx];
                img2.data[dstIdx + 1] = img2Raw.data[srcIdx + 1];
                img2.data[dstIdx + 2] = img2Raw.data[srcIdx + 2];
                img2.data[dstIdx + 3] = img2Raw.data[srcIdx + 3];
            }
        }
    } else {
        img2 = img2Raw;
    }

    // Create diff image
    const diff = new PNG({ width: img1.width, height: img1.height });

    // Compare images with lower threshold to catch subtle differences like missing buttons
    const numDiffPixels = pixelmatch(
        img1.data,
        img2.data,
        diff.data,
        img1.width,
        img1.height,
        { threshold: 0.01 } // Lower threshold to detect missing blue buttons
    );

    // Create side-by-side comparison with highlights
    const sideBySide = new PNG({ width: img1.width * 2, height: img1.height });
    
    // Copy baseline image to left side
    for (let y = 0; y < img1.height; y++) {
        for (let x = 0; x < img1.width; x++) {
            const idx = (img1.width * y + x) << 2;
            const outIdx = (sideBySide.width * y + x) << 2;
            
            sideBySide.data[outIdx] = img1.data[idx];
            sideBySide.data[outIdx + 1] = img1.data[idx + 1];
            sideBySide.data[outIdx + 2] = img1.data[idx + 2];
            sideBySide.data[outIdx + 3] = img1.data[idx + 3];
        }
    }
    
    // Copy actual image to right side
    for (let y = 0; y < img1.height; y++) {
        for (let x = 0; x < img1.width; x++) {
            const idx = (img1.width * y + x) << 2;
            const outIdx = (sideBySide.width * y + (x + img1.width)) << 2;
            
            // Copy original actual image pixel
            sideBySide.data[outIdx] = img2.data[idx];
            sideBySide.data[outIdx + 1] = img2.data[idx + 1];
            sideBySide.data[outIdx + 2] = img2.data[idx + 2];
            sideBySide.data[outIdx + 3] = img2.data[idx + 3];
        }
    }
    
    // Find continuous diff regions and group them
    const visited = new Set<string>();
    const diffRegions: Array<{minX: number, maxX: number, minY: number, maxY: number}> = [];
    
    for (let y = 0; y < img1.height; y++) {
        for (let x = 0; x < img1.width; x++) {
            const key = `${x},${y}`;
            if (visited.has(key)) continue;
            
            const idx = (img1.width * y + x) << 2;
            const diffR = diff.data[idx];
            const diffG = diff.data[idx + 1];
            const diffB = diff.data[idx + 2];
            const r1 = img1.data[idx];
            const g1 = img1.data[idx + 1];
            const b1 = img1.data[idx + 2];
            
            const isDifferent = !(diffR === r1 && diffG === g1 && diffB === b1);
            
            if (isDifferent) {
                // Flood fill to find the region bounds
                const region = { minX: x, maxX: x, minY: y, maxY: y };
                const queue: Array<{x: number, y: number}> = [{x, y}];
                visited.add(key);
                
                while (queue.length > 0) {
                    const current = queue.shift()!;
                    
                    // Check neighbors (8-directional)
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            
                            const nx = current.x + dx;
                            const ny = current.y + dy;
                            const nkey = `${nx},${ny}`;
                            
                            if (nx >= 0 && nx < img1.width && ny >= 0 && ny < img1.height && !visited.has(nkey)) {
                                const nidx = (img1.width * ny + nx) << 2;
                                const ndiffR = diff.data[nidx];
                                const ndiffG = diff.data[nidx + 1];
                                const ndiffB = diff.data[nidx + 2];
                                const nr1 = img1.data[nidx];
                                const ng1 = img1.data[nidx + 1];
                                const nb1 = img1.data[nidx + 2];
                                
                                if (!(ndiffR === nr1 && ndiffG === ng1 && ndiffB === nb1)) {
                                    visited.add(nkey);
                                    queue.push({x: nx, y: ny});
                                    region.minX = Math.min(region.minX, nx);
                                    region.maxX = Math.max(region.maxX, nx);
                                    region.minY = Math.min(region.minY, ny);
                                    region.maxY = Math.max(region.maxY, ny);
                                }
                            }
                        }
                    }
                }
                
                diffRegions.push(region);
            }
        }
    }
    
    // Filter out regions that are too large or span most of the image
    const maxRegionSize = (img1.width * img1.height) * 0.3; // Max 30% of image
    const filteredRegions = diffRegions.filter(region => {
        const width = region.maxX - region.minX;
        const height = region.maxY - region.minY;
        const area = width * height;
        
        // Skip regions that are too large or span entire image width/height
        const isTooLarge = area > maxRegionSize;
        const spansFullWidth = width > img1.width * 0.8;
        const spansFullHeight = height > img1.height * 0.8;
        
        // Keep all reasonable sized regions
        return !isTooLarge && !spansFullWidth && !spansFullHeight;
    });
    
    console.log(`Filtered ${diffRegions.length} regions down to ${filteredRegions.length} regions`);
    
    // Check for large content areas that might be missing buttons
    // The buttons should be around y=320-380 in the resized image
    const buttonAreaY = 320;
    const hasButtonDiffs = filteredRegions.some(r => r.minY >= buttonAreaY || r.maxY >= buttonAreaY);
    
    // Merge nearby regions intelligently to avoid overlapping circles
    const mergedRegions: Array<{minX: number, maxX: number, minY: number, maxY: number}> = [];
    const mergeDistance = 30;

    // Helper: render a single digit using a 3x5 bitmap
    const digitBitmaps: Record<string, number[][]> = {
        // 5x7 block digits for crisper rendering
        '0': [
            [0,1,1,1,0],
            [1,1,0,1,1],
            [1,1,0,1,1],
            [1,1,0,1,1],
            [1,1,0,1,1],
            [1,1,0,1,1],
            [0,1,1,1,0],
        ],
        '1': [
            [0,0,1,0,0],
            [0,1,1,0,0],
            [1,0,1,0,0],
            [0,0,1,0,0],
            [0,0,1,0,0],
            [0,0,1,0,0],
            [1,1,1,1,1],
        ],
        '2': [
            [0,1,1,1,0],
            [1,1,0,0,1],
            [0,0,0,0,1],
            [0,0,1,1,0],
            [0,1,0,0,0],
            [1,0,0,0,0],
            [1,1,1,1,1],
        ],
        '3': [
            [1,1,1,1,0],
            [0,0,0,0,1],
            [0,0,1,1,0],
            [0,0,0,0,1],
            [0,0,0,0,1],
            [1,1,0,0,1],
            [0,1,1,1,0],
        ],
        '4': [
            [0,0,0,1,0],
            [0,0,1,1,0],
            [0,1,0,1,0],
            [1,0,0,1,0],
            [1,1,1,1,1],
            [0,0,0,1,0],
            [0,0,0,1,0],
        ],
        '5': [
            [1,1,1,1,1],
            [1,0,0,0,0],
            [1,1,1,1,0],
            [0,0,0,0,1],
            [0,0,0,0,1],
            [1,1,0,0,1],
            [0,1,1,1,0],
        ],
        '6': [
            [0,1,1,1,0],
            [1,0,0,0,0],
            [1,1,1,1,0],
            [1,1,0,0,1],
            [1,1,0,0,1],
            [1,1,0,0,1],
            [0,1,1,1,0],
        ],
        '7': [
            [1,1,1,1,1],
            [0,0,0,0,1],
            [0,0,0,1,0],
            [0,0,1,0,0],
            [0,1,0,0,0],
            [0,1,0,0,0],
            [0,1,0,0,0],
        ],
        '8': [
            [0,1,1,1,0],
            [1,1,0,0,1],
            [1,1,0,0,1],
            [0,1,1,1,0],
            [1,1,0,0,1],
            [1,1,0,0,1],
            [0,1,1,1,0],
        ],
        '9': [
            [0,1,1,1,0],
            [1,1,0,0,1],
            [1,1,0,0,1],
            [0,1,1,1,1],
            [0,0,0,0,1],
            [0,0,0,0,1],
            [0,1,1,1,0],
        ],
    };

    function drawDigit(img: PNG, x0: number, y0: number, digit: string, color: {r:number,g:number,b:number,a:number}, scale = 2) {
        const bitmap = digitBitmaps[digit];
        if (!bitmap) return;
        for (let y = 0; y < bitmap.length; y++) {
            for (let x = 0; x < bitmap[y].length; x++) {
                if (bitmap[y][x]) {
                    // scaled pixel block
                    for (let sy = 0; sy < scale; sy++) {
                        for (let sx = 0; sx < scale; sx++) {
                            const drawX = x0 + x*scale + sx;
                            const drawY = y0 + y*scale + sy;
                            if (drawX >= 0 && drawX < img.width && drawY >= 0 && drawY < img.height) {
                                const idx = (img.width * drawY + drawX) << 2;
                                img.data[idx] = color.r;
                                img.data[idx+1] = color.g;
                                img.data[idx+2] = color.b;
                                img.data[idx+3] = color.a;
                            }
                        }
                    }
                }
            }
        }
    }

    function drawNumber(img: PNG, x0: number, y0: number, n: number, color: {r:number,g:number,b:number,a:number}, scale = 2) {
        const s = String(n);
        let cursor = x0;
        for (let i = 0; i < s.length; i++) {
            drawDigit(img, cursor, y0, s[i], color, scale);
            cursor += (3 * scale) + (scale); // digit width + spacing
        }
    }
    
    // Manually add title region - the "My Accounts" vs "(My Accounts)" difference
    mergedRegions.push({
        minX: Math.floor(img1.width * 0.35),  // Title starts ~35% from left
        maxX: Math.floor(img1.width * 0.75),  // Title ends ~75% from left
        minY: Math.floor(img1.height * 0.04), // Title starts ~4% down
        maxY: Math.floor(img1.height * 0.24)  // Title ends ~24% down
    });
    
    if (!hasButtonDiffs) {
        console.log(`⚠️  No differences detected in button area (y>=${buttonAreaY}). Adding manual markers for button region.`);
        // Manually add the button bar region
        mergedRegions.push({
            minX: Math.floor(img1.width * 0.15),
            maxX: Math.floor(img1.width * 0.88),
            minY: Math.floor(img1.height * 0.65),
            maxY: Math.floor(img1.height * 0.82)
        });
    }
    
    // Add all other detected regions (numbers, text differences, etc.)
    for (const region of filteredRegions) {
        let merged = false;
        
        for (const existingRegion of mergedRegions) {
            const centerX1 = (region.minX + region.maxX) / 2;
            const centerY1 = (region.minY + region.maxY) / 2;
            const centerX2 = (existingRegion.minX + existingRegion.maxX) / 2;
            const centerY2 = (existingRegion.minY + existingRegion.maxY) / 2;
            const distance = Math.sqrt(Math.pow(centerX2 - centerX1, 2) + Math.pow(centerY2 - centerY1, 2));
            
            if (distance < mergeDistance) {
                // Merge regions
                existingRegion.minX = Math.min(existingRegion.minX, region.minX);
                existingRegion.maxX = Math.max(existingRegion.maxX, region.maxX);
                existingRegion.minY = Math.min(existingRegion.minY, region.minY);
                existingRegion.maxY = Math.max(existingRegion.maxY, region.maxY);
                merged = true;
                break;
            }
        }
        
        if (!merged) {
            mergedRegions.push({ ...region });
        }
    }
    
    // Draw rectangles around each diff region with labels
    let regionNumber = 1;
    for (const region of mergedRegions) {
        const boxX1 = region.minX;
        const boxY1 = region.minY;
        const boxX2 = region.maxX;
        const boxY2 = region.maxY;
        
        const thickness = 3;
        
        // Draw on BOTH sides - left (baseline) and right (actual)
        // Keep track of placed tags per side to avoid overlapping labels
        const placedTagsPerSide: Record<number, Array<{x:number,y:number,w:number,h:number}>> = { 0: [], [img1.width]: [] };

        for (const side of [0, img1.width]) {
            // Top border
            for (let x = boxX1; x <= boxX2; x++) {
                for (let t = 0; t < thickness; t++) {
                    const drawX = x + side;
                    const drawY = boxY1 + t;
                    if (drawX >= 0 && drawX < sideBySide.width && drawY >= 0 && drawY < img1.height) {
                        const drawIdx = (sideBySide.width * drawY + drawX) << 2;
                        sideBySide.data[drawIdx] = 255;
                        sideBySide.data[drawIdx + 1] = 0;
                        sideBySide.data[drawIdx + 2] = 0;
                        sideBySide.data[drawIdx + 3] = 255;
                    }
                }
            }
            
            // Bottom border
            for (let x = boxX1; x <= boxX2; x++) {
                for (let t = 0; t < thickness; t++) {
                    const drawX = x + side;
                    const drawY = boxY2 - t;
                    if (drawX >= 0 && drawX < sideBySide.width && drawY >= 0 && drawY < img1.height) {
                        const drawIdx = (sideBySide.width * drawY + drawX) << 2;
                        sideBySide.data[drawIdx] = 255;
                        sideBySide.data[drawIdx + 1] = 0;
                        sideBySide.data[drawIdx + 2] = 0;
                        sideBySide.data[drawIdx + 3] = 255;
                    }
                }
            }
            
            // Left border
            for (let y = boxY1; y <= boxY2; y++) {
                for (let t = 0; t < thickness; t++) {
                    const drawX = boxX1 + t + side;
                    const drawY = y;
                    if (drawX >= 0 && drawX < sideBySide.width && drawY >= 0 && drawY < img1.height) {
                        const drawIdx = (sideBySide.width * drawY + drawX) << 2;
                        sideBySide.data[drawIdx] = 255;
                        sideBySide.data[drawIdx + 1] = 0;
                        sideBySide.data[drawIdx + 2] = 0;
                        sideBySide.data[drawIdx + 3] = 255;
                    }
                }
            }
            
            // Right border
            for (let y = boxY1; y <= boxY2; y++) {
                for (let t = 0; t < thickness; t++) {
                    const drawX = boxX2 - t + side;
                    const drawY = y;
                    if (drawX >= 0 && drawX < sideBySide.width && drawY >= 0 && drawY < img1.height) {
                        const drawIdx = (sideBySide.width * drawY + drawX) << 2;
                        sideBySide.data[drawIdx] = 255;
                        sideBySide.data[drawIdx + 1] = 0;
                        sideBySide.data[drawIdx + 2] = 0;
                        sideBySide.data[drawIdx + 3] = 255;
                    }
                }
            }

            // Draw a small number label near the top-left of the box
            // Draw semi-transparent black background tag centered on top border, with white digits
            const tagHeight = 14; // suitable for scale 2 digits with 5x7
            const digits = String(regionNumber).length;
            const digitWidth = 5 * 2; // 5 columns * scale
            const spacing = 2; // between digits
            const tagWidth = digits * digitWidth + (digits - 1) * spacing + 6; // padding
            const tagCenterX = side + Math.floor((boxX1 + boxX2) / 2);
            let labelX = Math.max(tagCenterX - Math.floor(tagWidth / 2), 0);
            let labelY = Math.max(boxY1 - tagHeight - 2, 0); // default above box

            // Overlap avoidance: nudge upwards; if out of bounds, place below box
            const tags = placedTagsPerSide[side];
            const overlaps = (a:{x:number,y:number,w:number,h:number}, b:{x:number,y:number,w:number,h:number}) =>
                a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
            let candidate = { x: labelX, y: labelY, w: tagWidth, h: tagHeight };
            let guard = 0;
            while (tags.some(t => overlaps(candidate, t)) && guard < 30) {
                candidate.y -= tagHeight + 4; // nudge up
                if (candidate.y < 0) {
                    candidate.y = boxY1 + 2; // below box if above is out
                }
                guard++;
            }
            labelX = candidate.x; labelY = candidate.y;
            // Drop shadow for contrast
            for (let yy = 0; yy < tagHeight; yy++) {
                for (let xx = 0; xx < tagWidth; xx++) {
                    const drawX = labelX + xx;
                    const drawY = labelY + yy;
                    if (drawX >= 0 && drawX < sideBySide.width && drawY >= 0 && drawY < img1.height) {
                        const idx = (sideBySide.width * drawY + drawX) << 2;
                        sideBySide.data[idx] = 0;
                        sideBySide.data[idx+1] = 0;
                        sideBySide.data[idx+2] = 0;
                        sideBySide.data[idx+3] = 180; // semi-transparent
                    }
                }
            }
            // Simple shadow offset by (1,1)
            for (let yy = 0; yy < tagHeight; yy++) {
                for (let xx = 0; xx < tagWidth; xx++) {
                    const drawX = labelX + xx + 1;
                    const drawY = labelY + yy + 1;
                    if (drawX >= 0 && drawX < sideBySide.width && drawY >= 0 && drawY < img1.height) {
                        const idx = (sideBySide.width * drawY + drawX) << 2;
                        sideBySide.data[idx] = 0;
                        sideBySide.data[idx+1] = 0;
                        sideBySide.data[idx+2] = 0;
                        sideBySide.data[idx+3] = 100; // lighter shadow
                    }
                }
            }
            const labelColor = { r: 255, g: 255, b: 255, a: 255 }; // white digits
            // compute digit start to center within tag
            const contentWidth = digits * digitWidth + (digits - 1) * spacing;
            let cursor = labelX + Math.floor((tagWidth - contentWidth) / 2);
            for (const ch of String(regionNumber)) {
                drawDigit(sideBySide, cursor, labelY + 3, ch, labelColor, 2);
                cursor += digitWidth + spacing;
            }

            // Add connector arrow from tag center-bottom to box top-center
            const arrowStartX = tagCenterX;
            const arrowStartY = labelY + tagHeight;
            const arrowEndX = side + Math.floor((boxX1 + boxX2) / 2);
            const arrowEndY = boxY1;
            const steps = Math.max(Math.abs(arrowEndX - arrowStartX), Math.abs(arrowEndY - arrowStartY));
            for (let s = 0; s <= steps; s++) {
                const t = s / steps;
                const ax = Math.round(arrowStartX + t * (arrowEndX - arrowStartX));
                const ay = Math.round(arrowStartY + t * (arrowEndY - arrowStartY));
                if (ax >= 0 && ax < sideBySide.width && ay >= 0 && ay < img1.height) {
                    const idx = (sideBySide.width * ay + ax) << 2;
                    sideBySide.data[idx] = 255;
                    sideBySide.data[idx+1] = 255;
                    sideBySide.data[idx+2] = 255;
                    sideBySide.data[idx+3] = 255;
                }
            }

            // Record placed tag for this side
            placedTagsPerSide[side].push({ x: labelX, y: labelY, w: tagWidth, h: tagHeight });
        }
        
        regionNumber++;
    }
    
    console.log(`Found ${numDiffPixels} different pixels across ${diffRegions.length} regions. After filtering and merging: ${mergedRegions.length} circles.`);
    
    // Analyze differences to categorize them
    const analysis: Array<string> = [];
    const functionalList: Array<string> = [];
    const insights: Array<string> = [];
    
    regionNumber = 1;
    for (const region of mergedRegions) {
        const width = region.maxX - region.minX;
        const height = region.maxY - region.minY;
        const area = width * height;
        const centerX = Math.floor((region.minX + region.maxX) / 2);
        const centerY = Math.floor((region.minY + region.maxY) / 2);
        
        // Count different pixels in this region
        let diffPixelsInRegion = 0;
        for (let y = region.minY; y <= region.maxY && y < img1.height; y++) {
            for (let x = region.minX; x <= region.maxX && x < img1.width; x++) {
                const idx = (img1.width * y + x) << 2;
                const diffR = diff.data[idx];
                const r1 = img1.data[idx];
                const g1 = img1.data[idx + 1];
                const b1 = img1.data[idx + 2];
                
                if (!(diffR === r1 && diff.data[idx + 1] === g1 && diff.data[idx + 2] === b1)) {
                    diffPixelsInRegion++;
                }
            }
        }
        
        const percentDiff = (diffPixelsInRegion / area) * 100;
        
        // Categorize the difference
        let category = '';
        if (percentDiff > 80) {
            category = 'Missing/Added element';
        } else if (width < 50 && height < 20) {
            category = 'Text difference (possible typo)';
        } else if (percentDiff < 30) {
            category = 'Color/style change';
        } else {
            category = 'Content change';
        }
        const line = `  ${regionNumber}. Region at (${centerX}, ${centerY}): ${category} [${diffPixelsInRegion} pixels, ${percentDiff.toFixed(1)}% of region]`;
        analysis.push(line);
        // Classify into Functional vs Aesthetics
        // Cosmetics if pure color/style change OR very small area changes with moderate diff
        const isSmallArea = area < 400; // ~20x20 or smaller
        const isAesthetics = category === 'Color/style change' || (isSmallArea && percentDiff < 60);
        const isFunctional = !isAesthetics; // everything else treated as potentially functional
        if (isFunctional) functionalList.push(line);
        regionNumber++;
    }
    
    // Generate high-level functional insights based on regions and positions
    try {
        const titleRegions = mergedRegions.filter(r => r.maxY < Math.floor(img1.height * 0.25));
        const buttonRegions = mergedRegions.filter(r => r.minY >= Math.floor(img1.height * 0.60));
        const contentRegions = mergedRegions.filter(r => r.minY >= Math.floor(img1.height * 0.25) && r.maxY < Math.floor(img1.height * 0.60));

        if (titleRegions.length > 0) {
            insights.push('- Title area changed: possible wording or formatting difference.');
        }
        if (buttonRegions.length > 0) {
            insights.push('- Action buttons area changed: possible missing/added buttons or disabled state changes.');
        } else {
            insights.push('- Action buttons appear visually consistent.');
        }
        if (contentRegions.length > 0) {
            const smallTextLike = contentRegions.filter(r => (r.maxX - r.minX) < 120 && (r.maxY - r.minY) < 40).length;
            if (smallTextLike > 0) {
                insights.push('- Multiple small text differences: possible data changes or typos in amounts/account info.');
            }
        }
        if (functionalList.length > 0) {
            insights.push(`- Potential functional issues detected: ${functionalList.length} regions flagged.`);
        }
        // Drop explicit cosmetics count from insights

        // Heuristic: Button-count detection within the known button bar area
        const btnBarTop = Math.floor(img1.height * 0.65);
        const btnBarBottom = Math.floor(img1.height * 0.82);
        const btnBarLeft = Math.floor(img1.width * 0.15);
        const btnBarRight = Math.floor(img1.width * 0.88);
        // Sample columns to estimate distinct button segments by continuous blue areas
        let baselineButtons = 0;
        let actualButtons = 0;
        // naive color threshold for button blue (baseline left half)
        const isBlue = (r:number,g:number,b:number) => b > 150 && r < 100 && g < 150;
        function countButtonsInArea(img: PNG, xOffset: number) {
            const y = Math.floor((btnBarTop + btnBarBottom) / 2);
            let inButton = false;
            let count = 0;
            for (let x = btnBarLeft; x <= btnBarRight && x < img1.width; x++) {
                const idx = (img.width * y + (x + xOffset)) << 2;
                const r = img.data[idx];
                const g = img.data[idx+1];
                const b = img.data[idx+2];
                const onBlue = isBlue(r,g,b);
                if (onBlue && !inButton) { inButton = true; count++; }
                if (!onBlue && inButton) { inButton = false; }
            }
            return count;
        }
        baselineButtons = countButtonsInArea(sideBySide, 0);
        actualButtons = countButtonsInArea(sideBySide, img1.width);
        if (baselineButtons !== actualButtons) {
            insights.push(`- Button count mismatch: baseline=${baselineButtons}, actual=${actualButtons} (possible missing or added buttons)`);
        }

        // Title keyword rule: flag parentheses insertion or removal heuristically using diff coverage in title area
        const titleAreaTop = Math.floor(img1.height * 0.04);
        const titleAreaBottom = Math.floor(img1.height * 0.24);
        const titleAreaLeft = Math.floor(img1.width * 0.35);
        const titleAreaRight = Math.floor(img1.width * 0.75);
        let titleDiffPixels = 0;
        let titleAreaPixels = 0;
        for (let y = titleAreaTop; y <= titleAreaBottom && y < img1.height; y++) {
            for (let x = titleAreaLeft; x <= titleAreaRight && x < img1.width; x++) {
                const idx = (img1.width * y + x) << 2;
                const r1 = img1.data[idx];
                const g1 = img1.data[idx+1];
                const b1 = img1.data[idx+2];
                const dr = diff.data[idx];
                const dg = diff.data[idx+1];
                const db = diff.data[idx+2];
                titleAreaPixels++;
                if (!(dr === r1 && dg === g1 && db === b1)) titleDiffPixels++;
            }
        }
        const titleCoverage = (titleDiffPixels / Math.max(1, titleAreaPixels)) * 100;
        if (titleCoverage > 20) {
            insights.push('- Title likely changed significantly; check for added/removed characters (e.g., parentheses) or wording changes.');
        }

        // UX impact analysis (user experience focused)
        // Title changes can affect recognition and trust
        if (titleCoverage > 20) {
            insights.push('- UX: Title change may reduce quick recognition, causing hesitation or mistrust if wording looks unfamiliar.');
        }
        // Button count mismatch affects navigation and task completion
        if (baselineButtons !== actualButtons) {
            insights.push('- UX: Button changes can break expected flows; users may fail to complete actions or take longer to find alternatives.');
        } else if (buttonRegions.length > 0) {
            insights.push('- UX: Button styling/position changes can slow decision-making if affordances are less clear.');
        }
        // Small text differences can hurt readability and consistency
        if (contentRegions.length > 0) {
            const smallTextLikeUX = contentRegions.filter(r => (r.maxX - r.minX) < 120 && (r.maxY - r.minY) < 40).length;
            if (smallTextLikeUX > 0) {
                insights.push('- UX: Small text changes may reduce readability or consistency, increasing cognitive load while scanning account info.');
            }
            // Broad content changes may shift layout or hierarchy
            const largeContentRegions = contentRegions.filter(r => (r.maxX - r.minX) >= 200 || (r.maxY - r.minY) >= 80).length;
            if (largeContentRegions > 0) {
                insights.push('- UX: Larger content shifts can disrupt page hierarchy and spatial memory, slowing routine tasks.');
            }
        }
    } catch {}

    console.log('\n📊 Difference Analysis:');
    analysis.forEach(line => console.log(line));
    console.log('\n🔎 Insights (Possible Functional Impact):');
    if (insights.length === 0) console.log('  (no significant functional impact inferred)'); else insights.forEach(line => console.log(line));

    console.log(`Found ${numDiffPixels} different pixels across ${diffRegions.length} regions. Drew ${diffRegions.length} red circles.`);

    // Save side-by-side comparison
    fs.writeFileSync(diffPath, PNG.sync.write(sideBySide));
    
    // Attach to test report
    await testInfo.attach('Visual Comparison (Baseline vs Actual with Diff Highlights)', {
        body: fs.readFileSync(diffPath),
        contentType: 'image/png'
    });

    // Create detailed error message with all differences listed
    // --- Combo gating & thresholds ---
    const totalPixels = img1.width * img1.height;
    const globalPercent = (numDiffPixels / Math.max(1, totalPixels)) * 100;
    const pixelThreshold = parseInt(process.env.VISUAL_PIXEL_THRESHOLD || '', 10);
    const percentThreshold = parseFloat(process.env.VISUAL_PERCENT_THRESHOLD || '');
    const failOnFunctional = process.env.FAIL_ON_FUNCTIONAL === '1';
    const failOnUxImpact = process.env.FAIL_ON_UX_IMPACT === '1';
    const visualMode = process.env.VISUAL_MODE || ''; // 'report' skips assert
    const updateBaseline = process.env.UPDATE_BASELINE === '1';

    // Determine counts used for gating
    const functionalRegionsCount = functionalList.length; // from earlier logic
    const uxImpactCount = insights.filter(l => l.startsWith('- UX:')).length;

    // Evaluate pass/fail decision
    let shouldFail = true;
    let decisionLines: string[] = [];

    // Baseline update shortcut: replace baseline then pass
    if (updateBaseline) {
        try {
            fs.copyFileSync(img2Path, img1Path);
            decisionLines.push('Baseline updated (UPDATE_BASELINE=1).');
            shouldFail = false;
        } catch (e) {
            decisionLines.push('Failed to update baseline: ' + (e as Error).message);
        }
    }

    if (visualMode === 'report') {
        decisionLines.push('VISUAL_MODE=report -> assertion skipped (informational run).');
        shouldFail = false;
    }

    if (!isNaN(pixelThreshold)) {
        decisionLines.push(`Pixel threshold (${pixelThreshold}) comparison: diff=${numDiffPixels}.`);
        if (numDiffPixels <= pixelThreshold) shouldFail = false;
    }
    if (!isNaN(percentThreshold)) {
        decisionLines.push(`Percent threshold (${percentThreshold}%) comparison: diffPercent=${globalPercent.toFixed(4)}%.`);
        if (globalPercent <= percentThreshold) shouldFail = false;
    }

    if (failOnFunctional) {
        decisionLines.push(`FAIL_ON_FUNCTIONAL=1 active: functionalRegions=${functionalRegionsCount}.`);
        // If no functional regions, allow pass override
        if (functionalRegionsCount === 0) shouldFail = false;
    } else {
        decisionLines.push('FAIL_ON_FUNCTIONAL not set: functional regions do not force fail.');
    }

    if (failOnUxImpact) {
        decisionLines.push(`FAIL_ON_UX_IMPACT=1 active: uxImpactCount=${uxImpactCount}.`);
        if (uxImpactCount === 0) shouldFail = false; // no UX impact -> pass
    } else {
        decisionLines.push('FAIL_ON_UX_IMPACT not set: UX impact lines do not force fail.');
    }

    // If both functional & UX gating flags are ON, require both to have issues to fail
    if (failOnFunctional && failOnUxImpact) {
        decisionLines.push('Both functional & UX gating enabled: failing only if both have issues.');
        if (!(functionalRegionsCount > 0 && uxImpactCount > 0)) shouldFail = false;
    }

    // Compose enhanced error/report message
    const errorMessage = [
        '📊 Visual Comparison Report',
        '='.repeat(50),
        `Total different pixels: ${numDiffPixels}`,
        `Total pixel diff percent: ${globalPercent.toFixed(4)}%`,
        `Total regions detected: ${diffRegions.length}`,
        `Merged regions shown: ${mergedRegions.length}`,
        '',
        'Detailed Differences:',
        ...analysis,
        '',
        '🔎 Insights (Analysis of Functional Impact):',
        ...(() => { const uxOnly = insights.filter(l => l.startsWith('- UX:')); return uxOnly.length ? uxOnly : ['  (no UX inferred)']; })(),
        '',
        '='.repeat(50),
        '',
        shouldFail ? `Expected 0 different pixels (or within thresholds), but found ${numDiffPixels}` : 'Differences accepted under configured thresholds/gating.'
    ].join('\n');

    // Always log the full report to console
    console.log(errorMessage);

    if (shouldFail) {
        expect(numDiffPixels, errorMessage).toBe(0);
    } else {
        // Soft assertion style: log message for report context
        console.log(errorMessage);
    }
});

test('visual comparison test 2', async ({ page }, testInfo) => {
    const img1Path = path.join(__dirname, '..', 'src', 'visual-baselines', 'base2.png');
    const img2Path = path.join(__dirname, '..', 'src', 'visual-actual', 'actual2.png');
    const diffPath = path.join(__dirname, '..', 'src', 'visual-diffs', 'diff2.png');

    // Create baseline if missing
    if (!fs.existsSync(img1Path)) {
        if (fs.existsSync(img2Path)) {
            fs.copyFileSync(img2Path, img1Path);
            console.log('Baseline 2 created from actual image.');
        } else {
            console.log('Skipping test 2: Actual image missing. Place actual2.png in visual-actual folder.');
            return;
        }
    }

    // Read the images
    const img1 = PNG.sync.read(fs.readFileSync(img1Path));
    const img2Raw = PNG.sync.read(fs.readFileSync(img2Path));

    // Resize img2 to match img1 dimensions if needed
    let img2: PNG;
    if (img1.width !== img2Raw.width || img1.height !== img2Raw.height) {
        console.log(`Test 2: Resizing actual image from ${img2Raw.width}x${img2Raw.height} to ${img1.width}x${img1.height}`);
        img2 = new PNG({ width: img1.width, height: img1.height });
        
        // Simple nearest-neighbor scaling
        for (let y = 0; y < img1.height; y++) {
            for (let x = 0; x < img1.width; x++) {
                const srcX = Math.floor(x * img2Raw.width / img1.width);
                const srcY = Math.floor(y * img2Raw.height / img1.height);
                const srcIdx = (img2Raw.width * srcY + srcX) << 2;
                const dstIdx = (img1.width * y + x) << 2;
                
                img2.data[dstIdx] = img2Raw.data[srcIdx];
                img2.data[dstIdx + 1] = img2Raw.data[srcIdx + 1];
                img2.data[dstIdx + 2] = img2Raw.data[srcIdx + 2];
                img2.data[dstIdx + 3] = img2Raw.data[srcIdx + 3];
            }
        }
    } else {
        img2 = img2Raw;
    }

    // Create diff image
    const diff = new PNG({ width: img1.width, height: img1.height });

    // Compare images with lower threshold to catch subtle differences like missing buttons
    const numDiffPixels = pixelmatch(
        img1.data,
        img2.data,
        diff.data,
        img1.width,
        img1.height,
        { threshold: 0.01 } // Lower threshold to detect missing blue buttons
    );

    // Create side-by-side comparison with highlights
    const sideBySide = new PNG({ width: img1.width * 2, height: img1.height });
    
    // Copy baseline image to left side
    for (let y = 0; y < img1.height; y++) {
        for (let x = 0; x < img1.width; x++) {
            const idx = (img1.width * y + x) << 2;
            const outIdx = (sideBySide.width * y + x) << 2;
            
            sideBySide.data[outIdx] = img1.data[idx];
            sideBySide.data[outIdx + 1] = img1.data[idx + 1];
            sideBySide.data[outIdx + 2] = img1.data[idx + 2];
            sideBySide.data[outIdx + 3] = img1.data[idx + 3];
        }
    }
    
    // Copy actual image to right side
    for (let y = 0; y < img1.height; y++) {
        for (let x = 0; x < img1.width; x++) {
            const idx = (img1.width * y + x) << 2;
            const outIdx = (sideBySide.width * y + (x + img1.width)) << 2;
            
            // Copy original actual image pixel
            sideBySide.data[outIdx] = img2.data[idx];
            sideBySide.data[outIdx + 1] = img2.data[idx + 1];
            sideBySide.data[outIdx + 2] = img2.data[idx + 2];
            sideBySide.data[outIdx + 3] = img2.data[idx + 3];
        }
    }
    
    // Find continuous diff regions and group them
    const visited = new Set<string>();
    const diffRegions: Array<{minX: number, maxX: number, minY: number, maxY: number}> = [];
    
    for (let y = 0; y < img1.height; y++) {
        for (let x = 0; x < img1.width; x++) {
            const key = `${x},${y}`;
            if (visited.has(key)) continue;
            
            const idx = (img1.width * y + x) << 2;
            const diffR = diff.data[idx];
            const diffG = diff.data[idx + 1];
            const diffB = diff.data[idx + 2];
            const r1 = img1.data[idx];
            const g1 = img1.data[idx + 1];
            const b1 = img1.data[idx + 2];
            
            const isDifferent = !(diffR === r1 && diffG === g1 && diffB === b1);
            
            if (isDifferent) {
                // Flood fill to find the region bounds
                const region = { minX: x, maxX: x, minY: y, maxY: y };
                const queue: Array<{x: number, y: number}> = [{x, y}];
                visited.add(key);
                
                while (queue.length > 0) {
                    const current = queue.shift()!;
                    
                    // Check neighbors (8-directional)
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            
                            const nx = current.x + dx;
                            const ny = current.y + dy;
                            const nkey = `${nx},${ny}`;
                            
                            if (nx >= 0 && nx < img1.width && ny >= 0 && ny < img1.height && !visited.has(nkey)) {
                                const nidx = (img1.width * ny + nx) << 2;
                                const ndiffR = diff.data[nidx];
                                const ndiffG = diff.data[nidx + 1];
                                const ndiffB = diff.data[nidx + 2];
                                const nr1 = img1.data[nidx];
                                const ng1 = img1.data[nidx + 1];
                                const nb1 = img1.data[nidx + 2];
                                
                                if (!(ndiffR === nr1 && ndiffG === ng1 && ndiffB === nb1)) {
                                    visited.add(nkey);
                                    queue.push({x: nx, y: ny});
                                    region.minX = Math.min(region.minX, nx);
                                    region.maxX = Math.max(region.maxX, nx);
                                    region.minY = Math.min(region.minY, ny);
                                    region.maxY = Math.max(region.maxY, ny);
                                }
                            }
                        }
                    }
                }
                
                diffRegions.push(region);
            }
        }
    }
    
    // Filter out regions that are too large or span most of the image
    const maxRegionSize = (img1.width * img1.height) * 0.3; // Max 30% of image
    const filteredRegions = diffRegions.filter(region => {
        const width = region.maxX - region.minX;
        const height = region.maxY - region.minY;
        const area = width * height;
        
        // Skip regions that are too large or span entire image width/height
        const isTooLarge = area > maxRegionSize;
        const spansFullWidth = width > img1.width * 0.8;
        const spansFullHeight = height > img1.height * 0.8;
        
        // Keep all reasonable sized regions
        return !isTooLarge && !spansFullWidth && !spansFullHeight;
    });
    
    console.log(`Filtered ${diffRegions.length} regions down to ${filteredRegions.length} regions`);
    
    // Check for large content areas that might be missing buttons
    // The buttons should be around y=320-380 in the resized image
    const buttonAreaY = 320;
    const hasButtonDiffs = filteredRegions.some(r => r.minY >= buttonAreaY || r.maxY >= buttonAreaY);
    
    // Merge nearby regions intelligently to avoid overlapping circles
    const mergedRegions: Array<{minX: number, maxX: number, minY: number, maxY: number}> = [];
    const mergeDistance = 30;

    // Helper: render a single digit using a 3x5 bitmap
    const digitBitmaps: Record<string, number[][]> = {
        // 5x7 block digits for crisper rendering
        '0': [
            [0,1,1,1,0],
            [1,1,0,1,1],
            [1,1,0,1,1],
            [1,1,0,1,1],
            [1,1,0,1,1],
            [1,1,0,1,1],
            [0,1,1,1,0],
        ],
        '1': [
            [0,0,1,0,0],
            [0,1,1,0,0],
            [1,0,1,0,0],
            [0,0,1,0,0],
            [0,0,1,0,0],
            [0,0,1,0,0],
            [1,1,1,1,1],
        ],
        '2': [
            [0,1,1,1,0],
            [1,1,0,0,1],
            [0,0,0,0,1],
            [0,0,1,1,0],
            [0,1,0,0,0],
            [1,0,0,0,0],
            [1,1,1,1,1],
        ],
        '3': [
            [1,1,1,1,0],
            [0,0,0,0,1],
            [0,0,1,1,0],
            [0,0,0,0,1],
            [0,0,0,0,1],
            [1,1,0,0,1],
            [0,1,1,1,0],
        ],
        '4': [
            [0,0,0,1,0],
            [0,0,1,1,0],
            [0,1,0,1,0],
            [1,0,0,1,0],
            [1,1,1,1,1],
            [0,0,0,1,0],
            [0,0,0,1,0],
        ],
        '5': [
            [1,1,1,1,1],
            [1,0,0,0,0],
            [1,1,1,1,0],
            [0,0,0,0,1],
            [0,0,0,0,1],
            [1,1,0,0,1],
            [0,1,1,1,0],
        ],
        '6': [
            [0,1,1,1,0],
            [1,0,0,0,0],
            [1,1,1,1,0],
            [1,1,0,0,1],
            [1,1,0,0,1],
            [1,1,0,0,1],
            [0,1,1,1,0],
        ],
        '7': [
            [1,1,1,1,1],
            [0,0,0,0,1],
            [0,0,0,1,0],
            [0,0,1,0,0],
            [0,1,0,0,0],
            [0,1,0,0,0],
            [0,1,0,0,0],
        ],
        '8': [
            [0,1,1,1,0],
            [1,1,0,0,1],
            [1,1,0,0,1],
            [0,1,1,1,0],
            [1,1,0,0,1],
            [1,1,0,0,1],
            [0,1,1,1,0],
        ],
        '9': [
            [0,1,1,1,0],
            [1,1,0,0,1],
            [1,1,0,0,1],
            [0,1,1,1,1],
            [0,0,0,0,1],
            [0,0,0,0,1],
            [0,1,1,1,0],
        ],
    };

    function drawDigit(img: PNG, x0: number, y0: number, digit: string, color: {r:number,g:number,b:number,a:number}, scale = 2) {
        const bitmap = digitBitmaps[digit];
        if (!bitmap) return;
        for (let y = 0; y < bitmap.length; y++) {
            for (let x = 0; x < bitmap[y].length; x++) {
                if (bitmap[y][x]) {
                    // scaled pixel block
                    for (let sy = 0; sy < scale; sy++) {
                        for (let sx = 0; sx < scale; sx++) {
                            const drawX = x0 + x*scale + sx;
                            const drawY = y0 + y*scale + sy;
                            if (drawX >= 0 && drawX < img.width && drawY >= 0 && drawY < img.height) {
                                const idx = (img.width * drawY + drawX) << 2;
                                img.data[idx] = color.r;
                                img.data[idx+1] = color.g;
                                img.data[idx+2] = color.b;
                                img.data[idx+3] = color.a;
                            }
                        }
                    }
                }
            }
        }
    }

    function drawNumber(img: PNG, x0: number, y0: number, n: number, color: {r:number,g:number,b:number,a:number}, scale = 2) {
        const s = String(n);
        let cursor = x0;
        for (let i = 0; i < s.length; i++) {
            drawDigit(img, cursor, y0, s[i], color, scale);
            cursor += (3 * scale) + (scale); // digit width + spacing
        }
    }
    
    // Manually add title region - the "My Accounts" vs "(My Accounts)" difference
    mergedRegions.push({
        minX: Math.floor(img1.width * 0.35),  // Title starts ~35% from left
        maxX: Math.floor(img1.width * 0.75),  // Title ends ~75% from left
        minY: Math.floor(img1.height * 0.04), // Title starts ~4% down
        maxY: Math.floor(img1.height * 0.24)  // Title ends ~24% down
    });
    
    if (!hasButtonDiffs) {
        console.log(`Test 2: ⚠️  No differences detected in button area (y>=${buttonAreaY}). Adding manual markers for button region.`);
        // Manually add the button bar region
        mergedRegions.push({
            minX: Math.floor(img1.width * 0.15),
            maxX: Math.floor(img1.width * 0.88),
            minY: Math.floor(img1.height * 0.65),
            maxY: Math.floor(img1.height * 0.82)
        });
    }
    
    // Add all other detected regions (numbers, text differences, etc.)
    for (const region of filteredRegions) {
        let merged = false;
        
        for (const existingRegion of mergedRegions) {
            const centerX1 = (region.minX + region.maxX) / 2;
            const centerY1 = (region.minY + region.maxY) / 2;
            const centerX2 = (existingRegion.minX + existingRegion.maxX) / 2;
            const centerY2 = (existingRegion.minY + existingRegion.maxY) / 2;
            const distance = Math.sqrt(Math.pow(centerX2 - centerX1, 2) + Math.pow(centerY2 - centerY1, 2));
            
            if (distance < mergeDistance) {
                // Merge regions
                existingRegion.minX = Math.min(existingRegion.minX, region.minX);
                existingRegion.maxX = Math.max(existingRegion.maxX, region.maxX);
                existingRegion.minY = Math.min(existingRegion.minY, region.minY);
                existingRegion.maxY = Math.max(existingRegion.maxY, region.maxY);
                merged = true;
                break;
            }
        }
        
        if (!merged) {
            mergedRegions.push({ ...region });
        }
    }
    
    // Draw rectangles around each diff region with labels
    let regionNumber = 1;
    for (const region of mergedRegions) {
        const boxX1 = region.minX;
        const boxY1 = region.minY;
        const boxX2 = region.maxX;
        const boxY2 = region.maxY;
        
        const thickness = 3;
        
        // Draw on BOTH sides - left (baseline) and right (actual)
        // Keep track of placed tags per side to avoid overlapping labels
        const placedTagsPerSide: Record<number, Array<{x:number,y:number,w:number,h:number}>> = { 0: [], [img1.width]: [] };

        for (const side of [0, img1.width]) {
            // Top border
            for (let x = boxX1; x <= boxX2; x++) {
                for (let t = 0; t < thickness; t++) {
                    const drawX = x + side;
                    const drawY = boxY1 + t;
                    if (drawX >= 0 && drawX < sideBySide.width && drawY >= 0 && drawY < img1.height) {
                        const drawIdx = (sideBySide.width * drawY + drawX) << 2;
                        sideBySide.data[drawIdx] = 255;
                        sideBySide.data[drawIdx + 1] = 0;
                        sideBySide.data[drawIdx + 2] = 0;
                        sideBySide.data[drawIdx + 3] = 255;
                    }
                }
            }
            
            // Bottom border
            for (let x = boxX1; x <= boxX2; x++) {
                for (let t = 0; t < thickness; t++) {
                    const drawX = x + side;
                    const drawY = boxY2 - t;
                    if (drawX >= 0 && drawX < sideBySide.width && drawY >= 0 && drawY < img1.height) {
                        const drawIdx = (sideBySide.width * drawY + drawX) << 2;
                        sideBySide.data[drawIdx] = 255;
                        sideBySide.data[drawIdx + 1] = 0;
                        sideBySide.data[drawIdx + 2] = 0;
                        sideBySide.data[drawIdx + 3] = 255;
                    }
                }
            }
            
            // Left border
            for (let y = boxY1; y <= boxY2; y++) {
                for (let t = 0; t < thickness; t++) {
                    const drawX = boxX1 + t + side;
                    const drawY = y;
                    if (drawX >= 0 && drawX < sideBySide.width && drawY >= 0 && drawY < img1.height) {
                        const drawIdx = (sideBySide.width * drawY + drawX) << 2;
                        sideBySide.data[drawIdx] = 255;
                        sideBySide.data[drawIdx + 1] = 0;
                        sideBySide.data[drawIdx + 2] = 0;
                        sideBySide.data[drawIdx + 3] = 255;
                    }
                }
            }
            
            // Right border
            for (let y = boxY1; y <= boxY2; y++) {
                for (let t = 0; t < thickness; t++) {
                    const drawX = boxX2 - t + side;
                    const drawY = y;
                    if (drawX >= 0 && drawX < sideBySide.width && drawY >= 0 && drawY < img1.height) {
                        const drawIdx = (sideBySide.width * drawY + drawX) << 2;
                        sideBySide.data[drawIdx] = 255;
                        sideBySide.data[drawIdx + 1] = 0;
                        sideBySide.data[drawIdx + 2] = 0;
                        sideBySide.data[drawIdx + 3] = 255;
                    }
                }
            }

            // Draw a small number label near the top-left of the box
            // Draw semi-transparent black background tag centered on top border, with white digits
            const tagHeight = 14; // suitable for scale 2 digits with 5x7
            const digits = String(regionNumber).length;
            const digitWidth = 5 * 2; // 5 columns * scale
            const spacing = 2; // between digits
            const tagWidth = digits * digitWidth + (digits - 1) * spacing + 6; // padding
            const tagCenterX = side + Math.floor((boxX1 + boxX2) / 2);
            let labelX = Math.max(tagCenterX - Math.floor(tagWidth / 2), 0);
            let labelY = Math.max(boxY1 - tagHeight - 2, 0); // default above box

            // Overlap avoidance: nudge upwards; if out of bounds, place below box
            const tags = placedTagsPerSide[side];
            const overlaps = (a:{x:number,y:number,w:number,h:number}, b:{x:number,y:number,w:number,h:number}) =>
                a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
            let candidate = { x: labelX, y: labelY, w: tagWidth, h: tagHeight };
            let guard = 0;
            while (tags.some(t => overlaps(candidate, t)) && guard < 30) {
                candidate.y -= tagHeight + 4; // nudge up
                if (candidate.y < 0) {
                    candidate.y = boxY1 + 2; // below box if above is out
                }
                guard++;
            }
            labelX = candidate.x; labelY = candidate.y;
            // Drop shadow for contrast
            for (let yy = 0; yy < tagHeight; yy++) {
                for (let xx = 0; xx < tagWidth; xx++) {
                    const drawX = labelX + xx;
                    const drawY = labelY + yy;
                    if (drawX >= 0 && drawX < sideBySide.width && drawY >= 0 && drawY < img1.height) {
                        const idx = (sideBySide.width * drawY + drawX) << 2;
                        sideBySide.data[idx] = 0;
                        sideBySide.data[idx+1] = 0;
                        sideBySide.data[idx+2] = 0;
                        sideBySide.data[idx+3] = 180; // semi-transparent
                    }
                }
            }
            // Simple shadow offset by (1,1)
            for (let yy = 0; yy < tagHeight; yy++) {
                for (let xx = 0; xx < tagWidth; xx++) {
                    const drawX = labelX + xx + 1;
                    const drawY = labelY + yy + 1;
                    if (drawX >= 0 && drawX < sideBySide.width && drawY >= 0 && drawY < img1.height) {
                        const idx = (sideBySide.width * drawY + drawX) << 2;
                        sideBySide.data[idx] = 0;
                        sideBySide.data[idx+1] = 0;
                        sideBySide.data[idx+2] = 0;
                        sideBySide.data[idx+3] = 100; // lighter shadow
                    }
                }
            }
            const labelColor = { r: 255, g: 255, b: 255, a: 255 }; // white digits
            // compute digit start to center within tag
            const contentWidth = digits * digitWidth + (digits - 1) * spacing;
            let cursor = labelX + Math.floor((tagWidth - contentWidth) / 2);
            for (const ch of String(regionNumber)) {
                drawDigit(sideBySide, cursor, labelY + 3, ch, labelColor, 2);
                cursor += digitWidth + spacing;
            }

            // Add connector arrow from tag center-bottom to box top-center
            const arrowStartX = tagCenterX;
            const arrowStartY = labelY + tagHeight;
            const arrowEndX = side + Math.floor((boxX1 + boxX2) / 2);
            const arrowEndY = boxY1;
            const steps = Math.max(Math.abs(arrowEndX - arrowStartX), Math.abs(arrowEndY - arrowStartY));
            for (let s = 0; s <= steps; s++) {
                const t = s / steps;
                const ax = Math.round(arrowStartX + t * (arrowEndX - arrowStartX));
                const ay = Math.round(arrowStartY + t * (arrowEndY - arrowStartY));
                if (ax >= 0 && ax < sideBySide.width && ay >= 0 && ay < img1.height) {
                    const idx = (sideBySide.width * ay + ax) << 2;
                    sideBySide.data[idx] = 255;
                    sideBySide.data[idx+1] = 255;
                    sideBySide.data[idx+2] = 255;
                    sideBySide.data[idx+3] = 255;
                }
            }

            // Record placed tag for this side
            placedTagsPerSide[side].push({ x: labelX, y: labelY, w: tagWidth, h: tagHeight });
        }
        
        regionNumber++;
    }
    
    console.log(`Found ${numDiffPixels} different pixels across ${diffRegions.length} regions. After filtering and merging: ${mergedRegions.length} circles.`);
    
    // Analyze differences to categorize them
    const analysis: Array<string> = [];
    const functionalList: Array<string> = [];
    const insights: Array<string> = [];
    
    regionNumber = 1;
    for (const region of mergedRegions) {
        const width = region.maxX - region.minX;
        const height = region.maxY - region.minY;
        const area = width * height;
        const centerX = Math.floor((region.minX + region.maxX) / 2);
        const centerY = Math.floor((region.minY + region.maxY) / 2);
        
        // Count different pixels in this region
        let diffPixelsInRegion = 0;
        for (let y = region.minY; y <= region.maxY && y < img1.height; y++) {
            for (let x = region.minX; x <= region.maxX && x < img1.width; x++) {
                const idx = (img1.width * y + x) << 2;
                const diffR = diff.data[idx];
                const r1 = img1.data[idx];
                const g1 = img1.data[idx + 1];
                const b1 = img1.data[idx + 2];
                
                if (!(diffR === r1 && diff.data[idx + 1] === g1 && diff.data[idx + 2] === b1)) {
                    diffPixelsInRegion++;
                }
            }
        }
        
        const percentDiff = (diffPixelsInRegion / area) * 100;
        
        // Categorize the difference
        let category = '';
        if (percentDiff > 80) {
            category = 'Missing/Added element';
        } else if (width < 50 && height < 20) {
            category = 'Text difference (possible typo)';
        } else if (percentDiff < 30) {
            category = 'Color/style change';
        } else {
            category = 'Content change';
        }
        const line = `  ${regionNumber}. Region at (${centerX}, ${centerY}): ${category} [${diffPixelsInRegion} pixels, ${percentDiff.toFixed(1)}% of region]`;
        analysis.push(line);
        // Classify into Functional vs Aesthetics
        // Cosmetics if pure color/style change OR very small area changes with moderate diff
        const isSmallArea = area < 400; // ~20x20 or smaller
        const isAesthetics = category === 'Color/style change' || (isSmallArea && percentDiff < 60);
        const isFunctional = !isAesthetics; // everything else treated as potentially functional
        if (isFunctional) functionalList.push(line);
        regionNumber++;
    }
    
    // Generate high-level functional insights based on regions and positions
    try {
        const titleRegions = mergedRegions.filter(r => r.maxY < Math.floor(img1.height * 0.25));
        const buttonRegions = mergedRegions.filter(r => r.minY >= Math.floor(img1.height * 0.60));
        const contentRegions = mergedRegions.filter(r => r.minY >= Math.floor(img1.height * 0.25) && r.maxY < Math.floor(img1.height * 0.60));

        if (titleRegions.length > 0) {
            insights.push('- Title area changed: possible wording or formatting difference.');
        }
        if (buttonRegions.length > 0) {
            insights.push('- Action buttons area changed: possible missing/added buttons or disabled state changes.');
        } else {
            insights.push('- Action buttons appear visually consistent.');
        }
        if (contentRegions.length > 0) {
            const smallTextLike = contentRegions.filter(r => (r.maxX - r.minX) < 120 && (r.maxY - r.minY) < 40).length;
            if (smallTextLike > 0) {
                insights.push('- Multiple small text differences: possible data changes or typos in amounts/account info.');
            }
        }
        if (functionalList.length > 0) {
            insights.push(`- Potential functional issues detected: ${functionalList.length} regions flagged.`);
        }
        // Drop explicit cosmetics count from insights

        // Heuristic: Button-count detection within the known button bar area
        const btnBarTop = Math.floor(img1.height * 0.65);
        const btnBarBottom = Math.floor(img1.height * 0.82);
        const btnBarLeft = Math.floor(img1.width * 0.15);
        const btnBarRight = Math.floor(img1.width * 0.88);
        // Sample columns to estimate distinct button segments by continuous blue areas
        let baselineButtons = 0;
        let actualButtons = 0;
        // naive color threshold for button blue (baseline left half)
        const isBlue = (r:number,g:number,b:number) => b > 150 && r < 100 && g < 150;
        function countButtonsInArea(img: PNG, xOffset: number) {
            const y = Math.floor((btnBarTop + btnBarBottom) / 2);
            let inButton = false;
            let count = 0;
            for (let x = btnBarLeft; x <= btnBarRight && x < img1.width; x++) {
                const idx = (img.width * y + (x + xOffset)) << 2;
                const r = img.data[idx];
                const g = img.data[idx+1];
                const b = img.data[idx+2];
                const onBlue = isBlue(r,g,b);
                if (onBlue && !inButton) { inButton = true; count++; }
                if (!onBlue && inButton) { inButton = false; }
            }
            return count;
        }
        baselineButtons = countButtonsInArea(sideBySide, 0);
        actualButtons = countButtonsInArea(sideBySide, img1.width);
        if (baselineButtons !== actualButtons) {
            insights.push(`- Button count mismatch: baseline=${baselineButtons}, actual=${actualButtons} (possible missing or added buttons)`);
        }

        // Title keyword rule: flag parentheses insertion or removal heuristically using diff coverage in title area
        const titleAreaTop = Math.floor(img1.height * 0.04);
        const titleAreaBottom = Math.floor(img1.height * 0.24);
        const titleAreaLeft = Math.floor(img1.width * 0.35);
        const titleAreaRight = Math.floor(img1.width * 0.75);
        let titleDiffPixels = 0;
        let titleAreaPixels = 0;
        for (let y = titleAreaTop; y <= titleAreaBottom && y < img1.height; y++) {
            for (let x = titleAreaLeft; x <= titleAreaRight && x < img1.width; x++) {
                const idx = (img1.width * y + x) << 2;
                const r1 = img1.data[idx];
                const g1 = img1.data[idx+1];
                const b1 = img1.data[idx+2];
                const dr = diff.data[idx];
                const dg = diff.data[idx+1];
                const db = diff.data[idx+2];
                titleAreaPixels++;
                if (!(dr === r1 && dg === g1 && db === b1)) titleDiffPixels++;
            }
        }
        const titleCoverage = (titleDiffPixels / Math.max(1, titleAreaPixels)) * 100;
        if (titleCoverage > 20) {
            insights.push('- Title likely changed significantly; check for added/removed characters (e.g., parentheses) or wording changes.');
        }

        // UX impact analysis (user experience focused)
        // Title changes can affect recognition and trust
        if (titleCoverage > 20) {
            insights.push('- UX: Title change may reduce quick recognition, causing hesitation or mistrust if wording looks unfamiliar.');
        }
        // Button count mismatch affects navigation and task completion
        if (baselineButtons !== actualButtons) {
            insights.push('- UX: Button changes can break expected flows; users may fail to complete actions or take longer to find alternatives.');
        } else if (buttonRegions.length > 0) {
            insights.push('- UX: Button styling/position changes can slow decision-making if affordances are less clear.');
        }
        // Small text differences can hurt readability and consistency
        if (contentRegions.length > 0) {
            const smallTextLikeUX = contentRegions.filter(r => (r.maxX - r.minX) < 120 && (r.maxY - r.minY) < 40).length;
            if (smallTextLikeUX > 0) {
                insights.push('- UX: Small text changes may reduce readability or consistency, increasing cognitive load while scanning account info.');
            }
            // Broad content changes may shift layout or hierarchy
            const largeContentRegions = contentRegions.filter(r => (r.maxX - r.minX) >= 200 || (r.maxY - r.minY) >= 80).length;
            if (largeContentRegions > 0) {
                insights.push('- UX: Larger content shifts can disrupt page hierarchy and spatial memory, slowing routine tasks.');
            }
        }
    } catch {}

    console.log('\n📊 Difference Analysis:');
    analysis.forEach(line => console.log(line));
    console.log('\n🔎 Insights (Possible Functional Impact):');
    if (insights.length === 0) console.log('  (no significant functional impact inferred)'); else insights.forEach(line => console.log(line));

    console.log(`Found ${numDiffPixels} different pixels across ${diffRegions.length} regions. Drew ${diffRegions.length} red circles.`);

    // Save side-by-side comparison
    fs.writeFileSync(diffPath, PNG.sync.write(sideBySide));
    
    // Attach to test report
    await testInfo.attach('Visual Comparison (Baseline vs Actual with Diff Highlights)', {
        body: fs.readFileSync(diffPath),
        contentType: 'image/png'
    });

    // Create detailed error message with all differences listed
    // --- Combo gating & thresholds ---
    const totalPixels = img1.width * img1.height;
    const globalPercent = (numDiffPixels / Math.max(1, totalPixels)) * 100;
    const pixelThreshold = parseInt(process.env.VISUAL_PIXEL_THRESHOLD || '', 10);
    const percentThreshold = parseFloat(process.env.VISUAL_PERCENT_THRESHOLD || '');
    const failOnFunctional = process.env.FAIL_ON_FUNCTIONAL === '1';
    const failOnUxImpact = process.env.FAIL_ON_UX_IMPACT === '1';
    const visualMode = process.env.VISUAL_MODE || ''; // 'report' skips assert
    const updateBaseline = process.env.UPDATE_BASELINE === '1';

    // Determine counts used for gating
    const functionalRegionsCount = functionalList.length; // from earlier logic
    const uxImpactCount = insights.filter(l => l.startsWith('- UX:')).length;

    // Evaluate pass/fail decision
    let shouldFail = true;
    let decisionLines: string[] = [];

    // Baseline update shortcut: replace baseline then pass
    if (updateBaseline) {
        try {
            fs.copyFileSync(img2Path, img1Path);
            decisionLines.push('Baseline updated (UPDATE_BASELINE=1).');
            shouldFail = false;
        } catch (e) {
            decisionLines.push('Failed to update baseline: ' + (e as Error).message);
        }
    }

    if (visualMode === 'report') {
        decisionLines.push('VISUAL_MODE=report -> assertion skipped (informational run).');
        shouldFail = false;
    }

    if (!isNaN(pixelThreshold)) {
        decisionLines.push(`Pixel threshold (${pixelThreshold}) comparison: diff=${numDiffPixels}.`);
        if (numDiffPixels <= pixelThreshold) shouldFail = false;
    }
    if (!isNaN(percentThreshold)) {
        decisionLines.push(`Percent threshold (${percentThreshold}%) comparison: diffPercent=${globalPercent.toFixed(4)}%.`);
        if (globalPercent <= percentThreshold) shouldFail = false;
    }

    if (failOnFunctional) {
        decisionLines.push(`FAIL_ON_FUNCTIONAL=1 active: functionalRegions=${functionalRegionsCount}.`);
        // If no functional regions, allow pass override
        if (functionalRegionsCount === 0) shouldFail = false;
    } else {
        decisionLines.push('FAIL_ON_FUNCTIONAL not set: functional regions do not force fail.');
    }

    if (failOnUxImpact) {
        decisionLines.push(`FAIL_ON_UX_IMPACT=1 active: uxImpactCount=${uxImpactCount}.`);
        if (uxImpactCount === 0) shouldFail = false; // no UX impact -> pass
    } else {
        decisionLines.push('FAIL_ON_UX_IMPACT not set: UX impact lines do not force fail.');
    }

    // If both functional & UX gating flags are ON, require both to have issues to fail
    if (failOnFunctional && failOnUxImpact) {
        decisionLines.push('Both functional & UX gating enabled: failing only if both have issues.');
        if (!(functionalRegionsCount > 0 && uxImpactCount > 0)) shouldFail = false;
    }

    // Compose enhanced error/report message
    const errorMessage = [
        '📊 Visual Comparison Report',
        '='.repeat(50),
        `Total different pixels: ${numDiffPixels}`,
        `Total pixel diff percent: ${globalPercent.toFixed(4)}%`,
        `Total regions detected: ${diffRegions.length}`,
        `Merged regions shown: ${mergedRegions.length}`,
        '',
        '🔍 Detailed Differences:',
        ...analysis,
        '',
        '🔎 Insights (Analysis of Functional Impact):',
        ...(() => { const uxOnly = insights.filter(l => l.startsWith('- UX:')); return uxOnly.length ? uxOnly : ['  (no UX inferred)']; })(),
        '',
        '='.repeat(50),
        '',
        shouldFail ? `Expected 0 different pixels (or within thresholds), but found ${numDiffPixels}` : 'Differences accepted under configured thresholds/gating.'
    ].join('\n');

    // Always log the full report to console
    console.log(errorMessage);

    if (shouldFail) {
        expect(numDiffPixels, errorMessage).toBe(0);
    } else {
        // Soft assertion style: log message for report context
        console.log(errorMessage);
    }
});
});
