const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const fetch = require('node-fetch'); // Assure-toi que c'est la v2 installée (npm install node-fetch@2)
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const TMP_DIR = path.join(__dirname, 'tmp');

// Crée le dossier tmp s’il n’existe pas
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

app.post('/generate', async (req, res) => {
  const { imageUrl } = req.body;
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl manquant' });

  const imagePath = path.join(TMP_DIR, `${uuidv4()}.jpg`);
  const videoPath = path.join(TMP_DIR, `${uuidv4()}.mp4`);

  try {
    // 1. Télécharger l’image
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('Erreur téléchargement image');
    const buffer = await response.buffer();
    await fsPromises.writeFile(imagePath, buffer);

    // 2. Paramètres FFmpeg
    const duration = 4; // secondes
    const fps = 30;
    const zoom = 1.5;
    const zoompanFilter = `zoompan=z=${zoom}:x='(iw-ow)*on/(${duration * fps})':y='(ih-oh)/2':d=${duration * fps}:s=720x1280,framerate=${fps}`;

    // 3. Générer la vidéo
    await new Promise((resolve, reject) => {
      ffmpeg(imagePath)
        .outputOptions([
          '-vf', zoompanFilter,
          '-c:v libx264',
          '-pix_fmt yuv420p',
        ])
        .on('start', cmd => console.log('Commande FFmpeg :', cmd))
        .on('progress', progress => {
          if (progress.percent) {
            process.stdout.write(`\rProgression : ${progress.percent.toFixed(1)}%`);
          }
        })
        .on('end', () => {
          console.log('\n✅ Vidéo générée avec succès !');
          resolve();
        })
        .on('error', (err) => {
          console.error('Erreur FFmpeg :', err.message);
          reject(err);
        })
        .save(videoPath);
    });

    // 4. Réponse avec chemin relatif (à adapter pour stockage externe)
    res.json({
      message: 'Vidéo générée avec succès',
      videoUrl: `/videos/${path.basename(videoPath)}`, // temporaire, pas accessible en prod
    });

  } catch (err) {
    console.error('Erreur générale:', err);
    res.status(500).json({ error: err.message });
  }
});

// Sert les vidéos du dossier tmp (temporaire, juste pour test)
app.use('/videos', express.static(TMP_DIR));

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
