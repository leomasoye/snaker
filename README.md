# 🐍 Snaker

Jeu multijoueur temps réel inspiré de Slither.io, développé avec **Pixi.js** et **WebSockets**.

---

## 🚀 Comment lancer le jeu

### 1. Installation des dépendances (si ce n'est pas déjà fait)
```bash
npm install
```

---

### 2. Mode Solo (Local uniquement)
Dans un terminal, lancez le serveur de développement :
```bash
npm run dev
```
Ouvrez ensuite [http://localhost:5173](http://localhost:5173) dans votre navigateur.

---

### 3. Mode Multijoueur

Pour jouer à plusieurs, vous devez lancer **le serveur WebSocket** et **le client Web** dans deux terminaux séparés :

#### Étape 1 : Démarrer le serveur de jeu (Terminal 1)
```bash
npm run server
```
*(Le serveur écoute sur le port `3001` et accepte les connexions réseau).*

#### Étape 2 : Démarrer le client Web (Terminal 2)
```bash
npm run dev:host
```
Vite affichera votre adresse locale sous cette forme :
```
  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
```

#### Étape 3 : Rejoindre la partie
- **Vous (l'hôte)** : Ouvrez `http://localhost:5173`
- **Vos amis (sur le même réseau Wi-Fi / LAN)** : Ils ouvrent l'adresse réseau `http://192.168.x.x:5173` depuis leur navigateur (PC ou mobile).
- Dans le menu principal, cliquez sur **MULTIJOUEUR**, choisissez une salle (**Alpha** ou **Bêta**) et cliquez sur **JOUER** !

---

## 🌐 Jouer avec des amis hors du réseau local (à distance)

Si vos amis ne sont pas sur le même réseau Wi-Fi :
- **Option simple (VPN maillé)** : Utilisez [Tailscale](https://tailscale.com/) (gratuit) : vos amis ouvrent simplement votre IP Tailscale sur le port `5173`.
- **Option tunnel** : Utilisez un outil comme [Ngrok](https://ngrok.com/) pour exposer vos ports `5173` et `3001`.
- **Option box internet** : Redirigez les ports `5173` et `3001` vers votre IP locale dans l'interface de votre box.

---

## 🎮 Contrôles
- **Souris** : Diriger le serpent
- **Clic gauche / Espace** : Accélérer (Boost)
- **Molette souris** : Zoomer / Dézoomer
