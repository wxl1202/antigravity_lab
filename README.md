# 美食雷達 (Food Radar)

這是一個基於 Python Flask 與 Google Maps API 的單頁網路應用程式，可以協助您快速尋找附近的高分美食。

## 功能特色
- **附近的美味**：根據您的位置顯示附近評分 4.0 以上的餐廳。
- **無縫體驗**：支援列表模式與地圖模式切換。
- **無限捲動**：滑動到底部自動載入更多推薦。
- **評論瀏覽**：點擊卡片即可查看最新的網友評論與照片。
- **正體中文**：全站介面與搜尋結果皆已在地化。

## 本地開發 (Local Development)

### 先決條件
- Python 3.9+
- Google Maps API Key (若無則會進入模擬模式)

### 啟動步驟

1. **建立虛擬環境**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

2. **安裝依賴**
   ```bash
   pip install -r requirements.txt
   ```

3. **設定環境變數**
   請將 `.env.example` 複製為 `.env` 並填入您的 API Key：
   ```bash
   cp .env .env.local
   # 編輯 .env 檔案填入 GOOGLE_MAPS_API_KEY=您的金鑰
   ```
   *(註：若您沒有 API Key，應用程式將會使用內建的模擬資料運行)*

4. **啟動伺服器**
   ```bash
   python app.py
   ```
   打開瀏覽器訪問 [http://localhost:8080](http://localhost:8080)

## 如何取得 Google Maps API Key

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)。
2. 建立一個新專案。
3. 前往 **APIs & Services > Library** 啟用以下兩個 API：
   - **Places API** (用於搜尋地點與評論)
   - **Maps JavaScript API** (用於顯示地圖)
4. 前往 **APIs & Services > Credentials** 建立 **API Key**。

## 部署至 Google Cloud Run (CI/CD)

本專案已包含 GitHub Actions 設定檔 (`.github/workflows/deploy.yaml`)，可自動部署至 Cloud Run。

### GitHub Actions 設定步驟 (人工動作)

為了讓自動部署生效，您需要在 GitHub Repository 的 **Settings > Secrets and variables > Actions** 中設定以下 Secrets：

1. **`GCP_PROJECT_ID`**
   - 您的 Google Cloud 專案 ID。

2. **`GCP_SA_KEY`**
   - **說明**：這是擁有 Cloud Run 部署權限的服務帳號金鑰 (JSON 格式)。
   - **取得方式**：
     1. 在 Google Cloud Console 建立一個 Service Account。
     2. 授予權限：`Cloud Run Admin`, `Storage Admin`, `Service Account User`。
     3. 建立並下載 JSON Key。
     4. 將 JSON 檔案內容完整複製貼上。

3. **`GOOGLE_MAPS_API_KEY`**
   - 您的 Google Maps API Key (這將會自動注入到 Cloud Run 的環境變數中)。

### 手動部署 (替代方案)

若您想直接從終端機部署：

```bash
gcloud run deploy nearby-eats \
  --source . \
  --platform managed \
  --region asia-east1 \
  --cpu 1 \
  --memory 256Mi \
  --min-instances 0 \
  --max-instances 5 \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_MAPS_API_KEY=您的金鑰
```
