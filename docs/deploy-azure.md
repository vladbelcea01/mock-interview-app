# Deploying the API to Azure Container Apps

One-time setup, run from a terminal with the Azure CLI. Everything after this is automated by
`.github/workflows/deploy.yml` (push to `main` → CI green → image to GHCR → migrations → new Container Apps revision).

## 0. Prerequisites

- Azure for Students subscription, Azure CLI ≥ 2.60
- Neon project; copy the **pooled** connection string (contains `-pooler` and `sslmode=require`)
- The first image already pushed to GHCR by the deploy workflow, and the package set to **public**
  (GitHub → profile → Packages → `mock-interview-api` → Package settings → Change visibility)

## 1. Prepare the subscription

```bash
az login
az extension add --name containerapp --upgrade
az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.OperationalInsights --wait

# Student subscriptions may only deploy to a few regions — pick a European one from this list
az policy assignment list \
  --query "[?parameters.listOfAllowedLocations.value!=null].parameters.listOfAllowedLocations.value[]" -o tsv
```

## 2. Create the Container App (first revision)

```bash
LOC=<allowed-region>            # e.g. westeurope / northeurope / swedencentral
RG=rg-mock-interviews
APP=mock-interview-api
IMAGE=ghcr.io/vladbelcea01/mock-interview-api:main

az group create -n $RG -l $LOC

az containerapp up -n $APP -g $RG -l $LOC \
  --image $IMAGE --ingress external --target-port 3000

az containerapp registry set -n $APP -g $RG --server ghcr.io

az containerapp secret set -n $APP -g $RG --secrets \
  database-url='<NEON_POOLED_CONNECTION_STRING>' \
  jwt-secret="$(openssl rand -base64 48)"

az containerapp update -n $APP -g $RG \
  --set-env-vars NODE_ENV=production JWT_EXPIRES_IN=1h \
    CORS_ORIGINS=http://localhost:4200 \
    DATABASE_URL=secretref:database-url JWT_SECRET=secretref:jwt-secret \
  --cpu 0.25 --memory 0.5Gi --min-replicas 1 --max-replicas 2

# Public URL
az containerapp show -n $APP -g $RG --query properties.configuration.ingress.fqdn -o tsv
```

Check: `curl https://<fqdn>/api/v1/health` → `{"status":"ok","db":"up"}`.

> On Windows PowerShell, replace `$(openssl rand -base64 48)` with any long random string and `\` line breaks with backticks.

## 3. Health probes

Portal → Container App → **Containers** → Edit and deploy → container → **Health probes**:
liveness and readiness = HTTP `GET /api/v1/health`, port 3000, initial delay 5 s. Save as new revision.

## 4. Let GitHub Actions deploy

```bash
SUB=$(az account show --query id -o tsv)
az ad sp create-for-rbac --name gh-mock-interviews --role contributor \
  --scopes /subscriptions/$SUB/resourceGroups/$RG --json-auth
```

In GitHub → repo → Settings → Secrets and variables → Actions, add:

| Secret | Value |
|---|---|
| `AZURE_CREDENTIALS` | the whole JSON printed above |
| `DATABASE_URL` | the Neon pooled connection string |

Re-run the **Deploy API** workflow (Actions → Deploy API → Run workflow). The Container App should show a new
revision whose image tag is the commit SHA.

## 5. After the frontend is on Vercel

```bash
az containerapp update -n $APP -g $RG \
  --set-env-vars CORS_ORIGINS=https://<your-app>.vercel.app,http://localhost:4200
```

## 6. After the review period

```bash
az containerapp update -n $APP -g $RG --min-replicas 0   # scale to zero, no idle cost
# or remove everything:
az group delete -n $RG
```

## Fallback: Render

If Azure isn't serving `/health` through CI by ~00:30, create a Render **Web Service** → *Deploy an existing image*
→ `ghcr.io/vladbelcea01/mock-interview-api:main`, set the same env vars (`DATABASE_URL`, `JWT_SECRET`,
`JWT_EXPIRES_IN`, `CORS_ORIGINS`, `PORT=3000`), then add its deploy hook URL as the GitHub secret
`RENDER_DEPLOY_HOOK`. The deploy workflow uses it automatically when `AZURE_CREDENTIALS` is absent.
