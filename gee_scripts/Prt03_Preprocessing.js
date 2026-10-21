// ============================================================
// MODUL 3 — SCRIPT MASTER PREPROCESSING LENGKAP
// (Pengujian Masking L8/L9 & S2, Composite T1 & T2, Evaluasi, & Ekspor)
// Wilayah Kajian : Sanggala Utara, Kabupaten Tana Toraja
// Mahasiswa      : M. Arief Abdillah (V126241003)
// File           : gee_scripts/Prt03_Preprocessing.js
// ============================================================

// ============================================================
// 1. KONFIGURASI PROYEK & AOI
// ============================================================
var aoiSanggala = ee.FeatureCollection("projects/ma-project-of-indonesian/assets/Sanggala_Utara");
var aoi = aoiSanggala.geometry();

var CONFIG = {
  aoi: aoi,
  // Periode T1 (Kondisi Awal / Masa Lalu) -> Landsat 8
  t1_start: '2015-01-01',
  t1_end: '2016-12-31',
  cloud_max_t1: 40,

  // Periode T2 (Kondisi Akhir / Masa Kini) -> Landsat 9
  t2_start: '2023-01-01',
  t2_end: '2024-12-31',
  cloud_max_t2: 40,

  export_scale: 30, // 30 meter untuk Landsat
  folder_drive: 'ProyekGEE_PemSpasial/data_processed'
};

// ============================================================
// 2. FUNGSI-FUNGSI CLOUD MASKING & INDEKS
// ============================================================

// 2a. Cloud Masking Landsat 8 & 9 (QA_PIXEL)
function maskL89sr(image) {
  image = ee.Image(image);
  var qa = image.select('QA_PIXEL');
  var cloudFree = qa.bitwiseAnd(1 << 4).eq(0); // Bit 4: Cloud
  var shadowFree = qa.bitwiseAnd(1 << 3).eq(0); // Bit 3: Cloud Shadow
  var snowFree = qa.bitwiseAnd(1 << 5).eq(0); // Bit 5: Snow/Ice
  var mask = cloudFree.and(shadowFree).and(snowFree);

  return ee.Image(image.updateMask(mask).divide(10000))
    .copyProperties(image, image.propertyNames());
}

// 2b. Cloud Masking Sentinel-2 (SCL Band)
function maskS2scl(image) {
  image = ee.Image(image);
  var scl = image.select('SCL');
  // Buang kelas noise: 0=NoData, 1=Defective, 3=Shadow, 8=CloudMed, 9=CloudHigh, 10=Cirrus
  var mask = scl.neq(0)
    .and(scl.neq(1))
    .and(scl.neq(3))
    .and(scl.neq(8))
    .and(scl.neq(9))
    .and(scl.neq(10));

  return ee.Image(image.updateMask(mask).divide(10000))
    .copyProperties(image, image.propertyNames());
}

// 2c. Fungsi Tambah Band NDVI
function tambahNDVI(image) {
  image = ee.Image(image);
  var ndvi = image.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDVI');
  return image.addBands(ndvi);
}

// 2d. Fungsi Membangun Composite Median Bersih
function buatComposite(dataset_id, start, end, cloud_max, label) {
  var koleksi = ee.ImageCollection(dataset_id)
    .filterDate(start, end)
    .filterBounds(CONFIG.aoi)
    .filterMetadata("CLOUD_COVER", "less_than", cloud_max)
    .map(maskL89sr);

  print('Jumlah scene ' + label + ' (' + start + ' s/d ' + end + '):', koleksi.size());
  return ee.Image(koleksi.median().clip(CONFIG.aoi));
}

// ============================================================
// 3. BAGIAN UJI CLOUD MASKING CITRA TUNGGAL (BAB 2.2 & 2.3)
// ============================================================

// ── Uji Landsat 9 (2024) ──
var koleksiTestL9 = ee.ImageCollection("LANDSAT/LC09/C02/T1_L2")
  .filterDate("2024-01-01", "2024-12-31")
  .filterBounds(CONFIG.aoi)
  .filterMetadata("CLOUD_COVER", "less_than", 50);

var citraL9Mentah = ee.Image(koleksiTestL9.first());
var citraL9Bersih = ee.Image(maskL89sr(citraL9Mentah));

print("─── 1. UJI MASKING LANDSAT 9 ───");
print("ID Citra L9 :", citraL9Mentah.id());
print("Tanggal L9  :", citraL9Mentah.date().format("YYYY-MM-dd"));
print("Awan L9 (%) :", citraL9Mentah.get("CLOUD_COVER"));

// ── Uji Sentinel-2 (2024) ──
var koleksiTestS2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
  .filterDate("2024-01-01", "2024-12-31")
  .filterBounds(CONFIG.aoi)
  .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 40));

var citraS2Mentah = ee.Image(koleksiTestS2.first());
var citraS2Bersih = ee.Image(maskS2scl(citraS2Mentah));

print("─── 2. UJI MASKING SENTINEL-2 ───");
print("ID Citra S2 :", citraS2Mentah.id());
print("Tanggal S2  :", citraS2Mentah.date().format("YYYY-MM-dd"));
print("Awan S2 (%) :", citraS2Mentah.get("CLOUDY_PIXEL_PERCENTAGE"));

// ============================================================
// 4. MEMBANGUN COMPOSITE T1 & T2 + NDVI (BAB 3.2)
// ============================================================
print("─── 3. MEMBANGUN COMPOSITE MULTITEMPORAL ───");

var compositeT1 = buatComposite(
  "LANDSAT/LC08/C02/T1_L2",
  CONFIG.t1_start,
  CONFIG.t1_end,
  CONFIG.cloud_max_t1,
  "T1 (Landsat 8)"
);

var compositeT2 = buatComposite(
  "LANDSAT/LC09/C02/T1_L2",
  CONFIG.t2_start,
  CONFIG.t2_end,
  CONFIG.cloud_max_t2,
  "T2 (Landsat 9)"
);

var compositeT1_final = tambahNDVI(compositeT1);
var compositeT2_final = tambahNDVI(compositeT2);

// ============================================================
// 5. EVALUASI KUALITAS COMPOSITE (BAB 4.1)
// ============================================================
print("─── 4. EVALUASI KUALITAS COMPOSITE ───");

// Total Piksel Teoretis AOI (Resolusi 30m)
var totalPixelAOI = ee.Number(ee.Image.constant(1).reduceRegion({
  reducer: ee.Reducer.count(),
  geometry: CONFIG.aoi,
  scale: CONFIG.export_scale,
  maxPixels: 1e10
}).get('constant'));

// Valid Pixel & Coverage (%) T1
var validPixelT1 = ee.Number(compositeT1_final.select("SR_B4").reduceRegion({
  reducer: ee.Reducer.count(),
  geometry: CONFIG.aoi,
  scale: CONFIG.export_scale,
  maxPixels: 1e10
}).get('SR_B4'));
var coverageT1 = validPixelT1.divide(totalPixelAOI).multiply(100);
print("Coverage T1 (%) :", coverageT1);

// Valid Pixel & Coverage (%) T2
var validPixelT2 = ee.Number(compositeT2_final.select("SR_B4").reduceRegion({
  reducer: ee.Reducer.count(),
  geometry: CONFIG.aoi,
  scale: CONFIG.export_scale,
  maxPixels: 1e10
}).get('SR_B4'));
var coverageT2 = validPixelT2.divide(totalPixelAOI).multiply(100);
print("Coverage T2 (%) :", coverageT2);

// Nilai Rata-rata Spektral T1 & T2
var statsT1 = compositeT1_final.select(["SR_B4", "SR_B5", "NDVI"]).reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: CONFIG.aoi,
  scale: CONFIG.export_scale,
  maxPixels: 1e10
});
print("Statistik Rata-rata T1 (B4, B5, NDVI):", statsT1);

var statsT2 = compositeT2_final.select(["SR_B4", "SR_B5", "NDVI"]).reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: CONFIG.aoi,
  scale: CONFIG.export_scale,
  maxPixels: 1e10
});
print("Statistik Rata-rata T2 (B4, B5, NDVI):", statsT2);

// ============================================================
// 6. VISUALISASI LAYER PETA (TERORGANISIR)
// ============================================================
Map.centerObject(CONFIG.aoi, 13);

// Parameter Visualisasi
var visLandsatTC = { bands: ['SR_B4', 'SR_B3', 'SR_B2'], min: 0, max: 0.3, gamma: 1.4 };
var visLandsatFC = { bands: ['SR_B5', 'SR_B4', 'SR_B3'], min: 0, max: 0.5 };
var visSentinelTC = { bands: ['B4', 'B3', 'B2'], min: 0, max: 0.3, gamma: 1.4 };
var visNDVI = { bands: ['NDVI'], min: -0.2, max: 0.8, palette: ['red', 'yellow', 'lightgreen', 'darkgreen'] };

// ── KELOMPOK 1: UJI CITRA TUNGGAL (Default: Non-aktif agar rapi) ──
Map.addLayer(citraL9Mentah.divide(10000).clip(CONFIG.aoi), visLandsatTC, 'Uji L9 - Sebelum Masking', false);
Map.addLayer(citraL9Bersih.clip(CONFIG.aoi), visLandsatTC, 'Uji L9 - Sesudah Masking', false);
Map.addLayer(citraL9Mentah.select('QA_PIXEL').clip(CONFIG.aoi), { min: 0, max: 30000, palette: ['black', 'white'] }, 'Uji L9 - QA_PIXEL Band', false);

Map.addLayer(citraS2Mentah.divide(10000).clip(CONFIG.aoi), visSentinelTC, 'Uji S2 - Sebelum Masking', false);
Map.addLayer(citraS2Bersih.clip(CONFIG.aoi), visSentinelTC, 'Uji S2 - Sesudah Masking (SCL)', false);
Map.addLayer(citraS2Mentah.select('SCL').clip(CONFIG.aoi), { min: 1, max: 11, palette: ['black', 'blue', 'gray', 'yellow', 'green', 'red'] }, 'Uji S2 - SCL Band', false);

// ── KELOMPOK 2: COMPOSITE MULTITEMPORAL T1 & T2 ──
Map.addLayer(compositeT1_final, visLandsatTC, 'T1 True Color (2015-2016)', false);
Map.addLayer(compositeT1_final, visLandsatFC, 'T1 False Color (2015-2016)', false);
Map.addLayer(compositeT1_final, visNDVI, 'T1 NDVI (2015-2016)', false);

Map.addLayer(compositeT2_final, visLandsatTC, 'T2 True Color (2023-2024)', true); // Tampil Utama
Map.addLayer(compositeT2_final, visLandsatFC, 'T2 False Color (2023-2024)', false);
Map.addLayer(compositeT2_final, visNDVI, 'T2 NDVI (2023-2024)', false);
Map.addLayer(compositeT2_final.select("SR_B4").mask(), { min: 0, max: 1, palette: ['black', 'white'] }, 'T2 Coverage Map (Putih=Valid)', false);

// ── KELOMPOK 3: BATAS WILAYAH AOI (Layer Teratas) ──
Map.addLayer(aoiSanggala.style({ color: 'red', fillColor: '00000000', width: 2 }), {}, 'Batas AOI Sanggala Utara');

// ============================================================
// 7. EKSPOR KE GOOGLE DRIVE (BAB 3.2)
// ============================================================
// Ekspor Composite T1
Export.image.toDrive({
  image: compositeT1_final,
  description: 'Composite_T1_Bersih_SanggalaUtara',
  folder: CONFIG.folder_drive,
  fileNamePrefix: 'composite_T1',
  region: CONFIG.aoi,
  scale: CONFIG.export_scale,
  crs: 'EPSG:4326',
  maxPixels: 1e13
});

// Ekspor Composite T2
Export.image.toDrive({
  image: compositeT2_final,
  description: 'Composite_T2_Bersih_SanggalaUtara',
  folder: CONFIG.folder_drive,
  fileNamePrefix: 'composite_T2',
  region: CONFIG.aoi,
  scale: CONFIG.export_scale,
  crs: 'EPSG:4326',
  maxPixels: 1e13
})