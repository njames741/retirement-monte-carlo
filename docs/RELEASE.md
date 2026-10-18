# v1.4.0（2026-10-18，尚未合併發布）

[Issue #9](https://github.com/njames741/retirement-monte-carlo/issues/9) 已實作：首頁退休計畫直接輸入最低每月生活費，以固定實質金額判定生活費成功率，並移除提領率探索。48 項計算／資料／Worker 測試、43 項桌面／手機案例及 12 項獨立數值稽核通過，手機 100k 依既有設定略過；[修改與驗證紀錄](REVISION_1_4.md)。

本次修改透過獨立分支及 PR 提供審閱，尚未更新 main 或公開網站。合併後仍由 Pages 工作流程驗證並發布，應以對應提交的 deploy 終態確認上線。

# v1.3.1（2026-10-17）

使用者已授權修正後直接推送。本版本修正 CPI 月份抽樣權重及獨立通膨亂數串流，精簡主畫面並以今天購買力說明金額；[修正內容及驗證](REVISION_1_3_1.md)。本機 44 項計算、31 項瀏覽器案例及 12 項獨立核對通過，手機 100k 按既有設定略過。

本版本沿用 main 推送自動驗證及發布；執行結果以 [Pages 工作流程](https://github.com/njames741/retirement-monte-carlo/actions/workflows/pages.yml) 的對應提交終態為準。公開入口：[退休研究室](https://njames741.github.io/retirement-monte-carlo/)。原始股票檔及月資料不包含在推送或 dist/。

# 後續改為自動 CI／CD（2026-10-17）

使用者已決定採「推送 main → 自動測試 → 通過後自動發布」。這取代下方歷史紀錄的手動發布限制。

- pages.yml 監聽 main 推送，依序完成語法、計算／資料、桌面及手機瀏覽器測試，再上傳 dist/ 並部署。deploy 必須等待 verify 成功，失敗不更新線上網站；只允許 main 發布。
- ci.yml 保留 PR 與手動檢查。PR 不發布，main 推送由 Pages 流程統一驗證及部署，不重複執行兩套相同測試；兩個流程均保留瀏覽器驗證 artifacts。
- 若要手動重跑，在 Actions 選 **Build and deploy GitHub Pages**，選 main 執行即可。已移除舊 confirm_publication 選項，因為使用者已授權後續 main 自動發布。
- 每次完成仍需確認 Actions 的 deploy 成功，並檢查實際公開網址；推送成功本身不表示部署已完成。

下方是過往發布紀錄；當時的手動流程不再適用於後續 main 推送。

# v1.3 已發布到 GitHub Pages（2026-10-17）

- Issues #4、#7、#8 的本地校準、內建數值唯讀、自訂草稿、模型狀態與匯出來源已完成，詳見 [REVISION_1_3](REVISION_1_3.md)。
- 41 項 Node／Worker／資料測試、31 項桌面／手機瀏覽器案例通過，手機 100k 依既有設定略過；分批驗證紀錄及實際瀏覽器檢查見 [QA](QA.md)。
- 發布資料包包含原創程式、CPI、VCMM 參考值及 MSCI 彙總參數／來源 metadata；不包含 MSCI 原始月序列、工作簿或清理後 CSV。使用條件查核見 [第三方紀錄](THIRD_PARTY_NOTICES.md)，沒有宣稱 MSCI 額外授權或背書。
- 已依使用者希望 GitHub.io 顯示新版的要求，將來源 commit [0cef7c5886bc7e028cfa02bfc8e8cd71f5c7556b](https://github.com/njames741/retirement-monte-carlo/commit/0cef7c5886bc7e028cfa02bfc8e8cd71f5c7556b) 發布至[公開網站](https://njames741.github.io/retirement-monte-carlo/)。[Pages 發布作業](https://github.com/njames741/retirement-monte-carlo/actions/runs/39043074090) 的 verify／deploy 均成功。
- 公開 HTTP 回應及實際瀏覽器均顯示 v1.3。既有自訂設定可遷移；選 MSCI 與內建固定通膨後，報酬 7.89%、對數波動 15.97%、通膨 2.00% 顯示且唯讀。TWD、50 年 × 10,000、seed 741 的線上模擬完成，畫面回報約 1.09 秒，耗盡 2,495 條、25.0%；未將此單次測時視為速度保證。[公開頁面畫面](screenshots/github-pages-v1.3.png)。
- GitHub main 更新仍不會自動更新 Pages，後續沿用手動發布流程。

下方為各次公開發布的歷史紀錄，資料包及功能狀態以各次版本為準。

# 初始資產千分位已發布（2026-10-17）

- [Issue #6](https://github.com/njames741/retirement-monte-carlo/issues/6) 已實作並更新至[公開網站](https://njames741.github.io/retirement-monte-carlo/)。資產輸入即時顯示千分位，支援含逗號貼上及正常編輯；計算、保存及匯出保留數值金額。
- 部署來源 commit [5d8b583ae6da6cc081ef8a3de454e5991018e586](https://github.com/njames741/retirement-monte-carlo/commit/5d8b583ae6da6cc081ef8a3de454e5991018e586)；[Pages 發布作業](https://github.com/njames741/retirement-monte-carlo/actions/runs/39039288741) 的 verify／deploy 均成功。
- 發布流程的語法檢查與 37 項計算／資料測試通過；瀏覽器測試 21 項通過，手機 100k 效能測試依既有設定略過。
- 在真正公開網址以 Chromium 桌面及 Pixel 7 尺寸模擬確認 TWD 30,000,000／USD 1,000,000、編輯刪除、保存還原及重設。以 3,000 萬、4% 年初提領、零報酬／費用／通膨的一年情境驗證：年度支出 120 萬、期末 2,880 萬，JSON 初始資產為數值 30000000，兩種尺寸的 pageerror 均為零。
- [公開頁面資產欄位截圖](screenshots/issue-6-live.png)。

# v1.2 已更新公開網站（2026-10-17）

- [公開網站](https://njames741.github.io/retirement-monte-carlo/) 已更新，部署來源 commit be2b69ecabae679d65099c43e315a57a6e079dd4。
- [PR #5](https://github.com/njames741/retirement-monte-carlo/pull/5) 已整合；issues #1、#2、#3 已關閉，#4 保留完整 MSCI 月資料待辦。
- [Pages 發布作業](https://github.com/njames741/retirement-monte-carlo/actions/runs/39026526081) verify／deploy 成功，沿用現有公開受眾與手動發布流程。
- 真正公開網址已驗證 v1.2、全新 TWD／3,000 萬、USD／100 萬、策略細節、內建美國 CPI 模擬、資料頁；沒有上傳欄位，pageerror 為零。
- [公開頁面截圖](screenshots/github-pages-v1.2.png)。未對既有 Sites 操作受眾或部署。

下方為首次發布的歷史紀錄。

# GitHub 保存與 GitHub Pages 發布

使用者於 2026-10-17 明確決定：公開 Repository 可以建立，網站須先本機試用並確認後才公開。此文件取代舊 Sites 雙來源／私人部署流程。

## 目前保存與發布狀態

Repository：[njames741/retirement-monte-carlo](https://github.com/njames741/retirement-monte-carlo)。原 bundle 的完整歷史保留於 main。本機 origin 指向此 repo。不要 force push；其他環境開工先 fetch 並整合。

使用者於 2026-10-17 進一步要求透過 GitHub.io 開啟試用，已授權本次公開發布。正式網址：[https://njames741.github.io/retirement-monte-carlo/](https://njames741.github.io/retirement-monte-carlo/)。發布 commit `ced591822f39fab8eaeb6e8c2a0ffb9e0c8572a1`；[Actions run](https://github.com/njames741/retirement-monte-carlo/actions/runs/39024556102) 的 verify 與 deploy 均成功。既有 Sites identity 保留於 .openai/hosting.json；本次不操作該 Site，原私人受眾不變。

## 開發與檢查

```sh
npm ci
npm test
npm run check
npx playwright install chromium
npm run test:browser
```

CI 使用 Ubuntu、Node 24、Chromium，另有 Pixel 7 viewport 模擬。瀏覽器測試實際服務 `/retirement-monte-carlo/`，檢查 Worker、表單、圖表、CSV、保存、比較、搜尋與下載。只有開發測試需要 Playwright，正式網站沒有該套件。

改變引擎再跑 `npm run benchmark`，並在實際瀏覽器測時。請勿把 Node 結果稱為瀏覽器結果。v1.4 已移除舊版的 `--swr` 搜尋量測。

## 手動發布程序（第一次已完成）

第一次已依使用者要求完成；後續仍維持手動發布，並保留權利盤點與測試程序：

1. Repository Settings → Pages → Build and deployment → Source 選 **GitHub Actions**。
2. Actions → **Publish GitHub Pages (manual approval)** → Run workflow。
3. 選 main，confirm_publication 選 **publish**；預設 no 會略過部署。
4. 工作流程先重跑 Node 與瀏覽器檢查，再將 **dist/** 上傳為 Pages artifact，透過 OIDC 部署，無自建長期 deploy token。
5. 檢查 deploy job 成功、回傳的 page_url 與實際公開頁面，測 module Worker、圖表及結果下載，記錄部署 commit／run URL。

工作流程僅 workflow_dispatch，沒有 push、schedule 或 workflow_run 部署觸發。即使 CI 通過也不會自動公開。若另獲使用者同意，才可改成 main push 自動發布；仍應保留測試依賴。

## 權利與封裝檢查

- dist 僅含原創 HTML/CSS/JS、.nojekyll 及原創第三方來源說明；沒有 MSCI 或 ETF 月數列、CPI 資料、第三方圖表、logo、外部字型或 API 憑證。
- local-data/、.env、bundle、ZIP、test-results/、node_modules/ 不進版控或 Pages artifact。
- tests/fixtures.mjs 為合成、可手算的測試數字，不會被部署為市場資料。
- 預設費用 0.06% 是版本化假設；總報酬含股息。ETF NAV 抽樣不重扣成本。
- Vanguard 只引用少量公開數值、改寫的方法摘要與原始連結，沒有複製完整表格、圖片或其專有模型。這不等於取得其個別再呈現許可；請參照 [第三方清單](THIRD_PARTY_NOTICES.md) 完成擁有者確認，必要時改為連結及使用者輸入錨點。
- 尚未選定原創程式的開源授權；不要擅自替擁有者加入 MIT 等授權。

## 回復與維護

若已公開後需要回復版本，以正常 revert commit 或手動選定經檢查的 main 版本重新發布，保留完整歷史。網站與本機各 origin 的 IndexedDB/localStorage 分離，GitHub Pages 不會自動帶入本機 CSV。每次發布都要由訪客自行匯入合法資料。

## 公開網址驗證

2026-10-17 在真正的 GitHub Pages URL 啟動 50 年 × 10,000 路徑，Worker 完成約 0.52 秒，耗盡機率 43.0%、雙重成功率 57.0%，與同 seed 的本機結果一致。P1/P99、對數刻度、年度滑桿及 CSV 下載可用，console 無 error／warn。[公開頁面畫面](screenshots/github-pages.png)。

本次未取得或聲稱新增 MSCI／Vanguard 個別資料授權；仍未散布完整月序列或官方完整表格。既有少量具來源引用及限制聲明維持不變。
