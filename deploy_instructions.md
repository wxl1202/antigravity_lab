# 部署說明 document

此應用程式已準備好部署至 **Google Cloud Run**。

## 先決條件
- 已啟用計費功能的 Google Cloud 專案。
- 已安裝並驗證 `gcloud` CLI。
- Google Maps API Key (建議使用以獲取真實資料，若無則使用模擬資料)。

### 如何取得 Google Maps API Key
1.  **前往 Google Cloud Console**: 訪問 [console.cloud.google.com](https://console.cloud.google.com/)。
2.  **建立專案**: 點擊 "Select a project" > "New Project" 並命名 (例如 "Nearby Eats")。
3.  **啟用 API**:
    - 前往 **APIs & Services** > **Library**。
    - 搜尋並啟用 **Places API** (用於後端資料)。
    - 搜尋並啟用 **Maps JavaScript API** (用於前端地圖)。
4.  **建立憑證**:
    - 前往 **APIs & Services** > **Credentials**。
    - 點擊 **+ Create Credentials** > **API Key**。
5.  **複製金鑰**: 複製產生的金鑰字串。
6.  *(選用但建議)* **限制金鑰**: 點擊金鑰名稱以編輯設定。
    - 在 "API restrictions" 下，選擇 "Restrict key" 並選取 "Places API" 和 "Maps JavaScript API"。
    - 在 "Application restrictions" 下，您稍後可以將其限制為您的特定網域或 IP。



## 部署步驟

1.  **建置並部署**
    在您的終端機執行以下指令 (請將 `[PROJECT_ID]` 替換為您的專案 ID，並將 `[API_KEY]` 替換為您的 Google Maps API Key)：

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
    --set-env-vars GOOGLE_MAPS_API_KEY=[API_KEY]
    ```

    *如果您沒有 API Key，可以省略 `--set-env-vars` 參數，應用程式將使用模擬資料。*

2.  **訪問應用程式**
    部署完成後，指令將會輸出一個服務 URL (例如 `https://nearby-eats-xyz-uc.a.run.app`)。在瀏覽器中開啟此 URL 即可。

## 本地測試 (Docker)

1.  **建置**
    ```bash
    docker build -t nearby-eats .
    ```

2.  **執行**
    ```bash
    docker run -p 8080:8080 -e GOOGLE_MAPS_API_KEY=[API_KEY] nearby-eats
    ```
