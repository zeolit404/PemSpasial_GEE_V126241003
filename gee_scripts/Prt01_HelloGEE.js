// ============================================================
// SCRIPT GEE PERTAMA — Hello GEE!
// ============================================================
// Tampilkan pesan awal
print("Halo dari Google Earth Engine!");
print("Nama saya:", "M. Arief Abdillah");
// Panggil AOI dari project (dari GEE Assets)
var aoi = ee.FeatureCollection("projects/ma-project-of-indonesian/assets/Sanggala_Utara");
// Fokuskan peta pada AOI Sanggala Utara dengan level zoom 15
Map.centerObject(aoi, 15);
// Panggil dan filter citra Landsat 9
var landsat9 = ee.ImageCollection("LANDSAT/LC09/C02/T1_L2")
    .filterDate("2025-01-01", "2025-12-31")          // Ambil rentang waktu tahun 2025
    .filterBounds(aoi)                               // Sesuaikan dengan wilayah AOI
    .filterMetadata("CLOUD_COVER", "less_than", 20)  // Filter awan di bawah 20%
    .first();                                        // Ambil satu citra pertama/terbaik
// Tampilkan informasi metadata citra ke panel Console
print("Informasi citra Landsat 9 Sanggala Utara:", landsat9);

// Potong (clip) citra agar rapi mengikuti batas poligon AOI
var landsat9_clip = landsat9.clip(aoi);
// 1. Tampilkan Layer 1: Citra True Color (Warna Asli)
Map.addLayer(
    landsat9_clip,
    { bands: ['SR_B4', 'SR_B3', 'SR_B2'], min: 7000, max: 13000 },
    'Landsat9 True Color 2025 (Clipped)'
);

// 2. Tampilkan Layer 2: Citra False Color (Warna Semu - Vegetasi Merah)
var visParamsFalseColor = {
    bands: ["SR_B5", "SR_B4", "SR_B3"],  // NIR, Merah, Hijau
    min: 7000,
    max: 18000
};
Map.addLayer(
    landsat9_clip,
    visParamsFalseColor,
    'Landsat9 False Color 2025 (Clipped)'
);
// 3. Tampilkan Layer 3: Garis batas (Outline) AOI
Map.addLayer(
    aoi.style({
        color: 'red',
        fillColor: '00000000', // transparan (hollow)
        width: 2
    }),
    {},
    'Batas AOI Sanggala Utara'
);