# 🚀 GCP Deployment Setup - Voor Niels

Complete stap-voor-stap instructies voor het koppelen van GitHub aan GCP Cloud Build.

## ✅ Wat Is Er Klaar?

- ✅ GitHub repository: https://github.com/groeimetai/snow-flow-enterprise
- ✅ Branches aangemaakt: `main` en `test`
- ✅ Cloud Build configuraties: `cloudbuild-test.yaml` en `cloudbuild-prod.yaml`
- ✅ Dockerfile met health checks
- ✅ Setup script: `setup-gcp-triggers.sh`
- ✅ Complete documentatie: `DEPLOYMENT.md`

## 🎯 Wat Moet Je Nog Doen? (15 minuten)

### Stap 1: GCP Project Aanmaken (5 min)

1. Ga naar: https://console.cloud.google.com
2. Klik op project dropdown (naast Google Cloud logo)
3. Klik "New Project"
4. Vul in:
   - **Project name:** `Snow-Flow Enterprise`
   - **Project ID:** `snow-flow-enterprise` (of iets anders unieks)
   - **Organization:** Groeimetai (als je die hebt)
5. Klik "Create"
6. Wacht tot project is aangemaakt (~30 seconden)

### Stap 2: Billing Inschakelen (2 min)

1. Ga naar: https://console.cloud.google.com/billing
2. Selecteer je nieuwe project
3. Klik "Link a billing account"
4. Kies bestaande billing account of maak nieuwe aan
5. **Kosten:** ~€15-30/maand (test + productie samen)

### Stap 3: gcloud CLI Installeren (5 min - SKIP als je dit al hebt)

**macOS:**
```bash
# Download installer
curl https://sdk.cloud.google.com | bash

# Restart terminal
exec -l $SHELL

# Initialize
gcloud init
```

**Of via Homebrew:**
```bash
brew install --cask google-cloud-sdk
gcloud init
```

**Verificatie:**
```bash
gcloud --version
# Moet output geven zoals: Google Cloud SDK 460.0.0
```

### Stap 4: Setup Script Uitvoeren (2 min)

```bash
cd /Users/nielsvanderwerf/snow-flow/enterprise

# Maak script executable
chmod +x setup-gcp-triggers.sh

# Run setup (gebruik je PROJECT_ID uit stap 1)
./setup-gcp-triggers.sh snow-flow-enterprise
```

**Het script doet:**
- ✅ Enables Cloud Build, Cloud Run, Secret Manager APIs
- ✅ Maakt ADMIN_KEY secret aan (print deze, bewaar hem!)
- ✅ Maakt backup storage bucket aan
- ✅ Maakt Cloud Build triggers aan voor test + prod

**BELANGRIJK:** Het script print een ADMIN_KEY - **bewaar deze!** Je hebt hem nodig voor de `/stats` API endpoint.

### Stap 5: GitHub Repository Koppelen (3 min) ⚠️ BELANGRIJKSTE STAP!

1. Ga naar: https://console.cloud.google.com/cloud-build/triggers/connect?project=snow-flow-enterprise

   *(vervang `snow-flow-enterprise` door je PROJECT_ID als die anders is)*

2. Klik **"Connect Repository"**

3. Selecteer **"GitHub (Cloud Build GitHub App)"**

4. Klik **"Continue"**

5. **GitHub autorisatie:**
   - Log in met je GitHub account (groeimetai)
   - Klik "Authorize Google Cloud Build"
   - Klik "Install Google Cloud Build" (op je organization)

6. **Selecteer repository:**
   - Zoek: `groeimetai/snow-flow-enterprise`
   - Click checkbox
   - Click "Connect"

7. **Skip trigger creation**
   - Click "Done" (triggers zijn al aangemaakt via script!)

### Stap 6: Verificatie (1 min)

```bash
# Check of triggers zijn aangemaakt
gcloud builds triggers list

# Je moet zien:
# NAME                    TRIGGER_TYPE  BRANCH
# license-server-test     github        ^test$
# license-server-prod     github        ^main$
```

**Of via web console:**
https://console.cloud.google.com/cloud-build/triggers

## 🎉 Klaar! Nu Werkt Het Automatisch

### Test Deployment

```bash
# Maak een kleine wijziging
cd /Users/nielsvanderwerf/snow-flow/enterprise
git checkout test
echo "# Test" >> README.md
git add README.md
git commit -m "test: trigger deployment"
git push origin test
```

**Wat gebeurt er nu automatisch:**
1. ✨ Cloud Build detecteert push naar `test` branch
2. 🔨 Bouwt Docker image
3. 🚀 Deploy naar Cloud Run: `license-server-test`
4. 📍 URL: https://license-server-test-XXX.run.app

**Volg de build:**
https://console.cloud.google.com/cloud-build/builds

### Production Deployment

```bash
# Na testen, merge naar main
git checkout main
git merge test
git push origin main
```

**Wat gebeurt er nu automatisch:**
1. ✨ Cloud Build detecteert push naar `main` branch
2. 🔨 Bouwt Docker image
3. 🚀 Deploy naar Cloud Run: `license-server-prod`
4. 📍 URL: https://license-server-prod-XXX.run.app

## 📊 Je Deployments Bekijken

**Cloud Run Services:**
https://console.cloud.google.com/run

**Cloud Build History:**
https://console.cloud.google.com/cloud-build/builds

**Logs (Test):**
```bash
gcloud run services logs read license-server-test --limit=50
```

**Logs (Production):**
```bash
gcloud run services logs read license-server-prod --limit=50
```

## 🔑 ADMIN_KEY Ophalen

Als je de ADMIN_KEY bent vergeten:

```bash
gcloud secrets versions access latest --secret=ADMIN_KEY --project=snow-flow-enterprise
```

## 🌐 URLs Vinden

**Test URL:**
```bash
gcloud run services describe license-server-test --region=europe-west4 --format="value(status.url)"
```

**Production URL:**
```bash
gcloud run services describe license-server-prod --region=europe-west4 --format="value(status.url)"
```

## ✅ Checklist

- [ ] GCP project aangemaakt
- [ ] Billing ingeschakeld
- [ ] gcloud CLI geïnstalleerd en geïnitialiseerd
- [ ] Setup script uitgevoerd (`./setup-gcp-triggers.sh`)
- [ ] ADMIN_KEY bewaard
- [ ] GitHub repository gekoppeld aan Cloud Build
- [ ] Triggers geverifieerd (`gcloud builds triggers list`)
- [ ] Test deployment geprobeerd (push naar test branch)
- [ ] Production deployment geprobeerd (push naar main branch)
- [ ] URLs getest (`/health` endpoint)

## 🆘 Hulp Nodig?

**Algemene problemen:**

1. **"Permission denied"**
   - Run: `gcloud auth login`
   - Run: `gcloud config set project snow-flow-enterprise`

2. **"API not enabled"**
   - Het setup script zou dit moeten fixen
   - Handmatig: https://console.cloud.google.com/apis/library

3. **"GitHub connection failed"**
   - Zorg dat je eigenaar bent van groeimetai organization
   - Of gebruik personal repository in plaats van organization

4. **"Build failed"**
   - Check build logs: https://console.cloud.google.com/cloud-build/builds
   - Vaak: Node version mismatch of TypeScript errors

**Meer info:**
- Zie `DEPLOYMENT.md` voor complete troubleshooting guide
- GCP Support: https://cloud.google.com/support

## 💰 Kosten Verwachting

**Per Maand:**
- Test environment: €3-5 (scale to zero)
- Production environment: €10-15 (always warm)
- Cloud Storage (backups): €1-2
- **Totaal: ~€15-30/maand**

**Free tier:**
- Cloud Build: 120 builds/maand gratis
- Cloud Run: 2 million requests/maand gratis
- Secret Manager: 6 secrets gratis

## 📚 Volgende Stappen

Na succesvolle deployment:

1. **Custom domain** toevoegen (optioneel):
   - Zie `DEPLOYMENT.md` sectie "Custom Domain Setup"
   - Kost geen extra, alleen DNS configuratie

2. **Monitoring & alerts** instellen:
   - Zie `DEPLOYMENT.md` sectie "Monitoring & Alerts"
   - Email notifications bij errors

3. **Database backups** automatiseren:
   - Zie `DEPLOYMENT.md` sectie "Database Backups"
   - Cloud Scheduler + Cloud Function

4. **Load testing**:
   - Test hoeveel concurrent requests het aankan
   - Pas `--max-instances` aan indien nodig

---

**Succes met de deployment! 🚀**

Vragen? Check `DEPLOYMENT.md` of laat het me weten!
