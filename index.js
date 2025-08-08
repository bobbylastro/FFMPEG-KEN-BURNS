const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const fetch = require('node-fetch'); // v2
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const TMP_DIR = path.join(__dirname, 'tmp');

if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

app.post('/generate', async (req, res) => {
  const { imageUrl } = req.body;
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl manquant' });

  const imagePath = path.join(TMP_DIR, `${uuidv4()}.jpg`);
  const videoPath = path.join(TMP_DIR, `${uuidv4()}.mp4`);

  try {
    // Télécharger l’image
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('Erreur téléchargement image');
    const buffer = await response.buffer();
    await fsPromises.writeFile(imagePath, buffer);

    // Paramètres vidéo
    const duration = 4; // secondes
    const fps = 30;
    const zoom = 1.5;
    const totalFrames = duration * fps;

    // Filtre FFmpeg corrigé :
    // - scale=-1:1280 → redimensionne en gardant le ratio, hauteur = 1280 px
    // - zoompan avec fps, zoom fixe, pan horizontal, crop 720x1280
    const ffmpegFilter = [
      'scale=-1:1280',
      `zoompan=fps=${fps}:z=${zoom}:x='iw/2-(iw/${zoom}/2)+(on/(${totalFrames}-1))*((iw/${zoom})-720)':y='ih/2-(ih/${zoom}/2)':d=${totalFrames}:s=720x1280`
    ].join(',');

    await new Promise((resolve, reject) => {
      ffmpeg(imagePath)
        .outputOptions([
          '-vf', ffmpegFilter,
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-t', duration.toString(),
          '-movflags', '+faststart' // lecture progressive web
        ])
        .on('start', cmd => console.log('Commande FFmpeg:', cmd))
        .on('progress', progress => {
          if (progress.percent) {
            process.stdout.write(`\rProgression : ${progress.percent.toFixed(1)}%`);
          }
        })
        .on('end', () => {
          console.log('\n✅ Vidéo générée avec succès !');
          resolve();
        })
        .on('error', err => {
          console.error('Erreur FFmpeg :', err.message);
          reject(err);
        })
        .save(videoPath);
    });

    // Supprimer l’image temporaire
    await fsPromises.unlink(imagePath);

    // Répondre avec l'URL pour accéder à la vidéo (adapter selon ton hébergement)
    res.json({
      message: 'Vidéo générée avec succès',
      videoUrl: `/videos/${path.basename(videoPath)}`
    });

  } catch (err) {
    console.error('Erreur générale:', err);
    try {
      if (fs.existsSync(imagePath)) await fsPromises.unlink(imagePath);
    } catch {}
    res.status(500).json({ error: err.message });
  }
});

// Servir les vidéos statiques du dossier tmp (juste pour test)
app.use('/videos', express.static(TMP_DIR));

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
