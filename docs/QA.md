# v1.4.0 最低每月生活費（2026-10-18）

計算／資料／Worker 測試 **48/48**、桌面及 Pixel 7 瀏覽器 **43 通過、1 略過**（既有手機 100k）、獨立數值稽核 **12/12** 通過。涵蓋固定金額跨資產／提領率、首年不足、後續實質支出下降、精確邊界、零提領、零底線、舊比例遷移、幣種切換、無效草稿及結果／匯出一致性；變更底線不會改變資產與支出路徑。已人工檢視桌面及手機畫面；完整紀錄及截圖見 [v1.4 驗證](REVISION_1_4.md)。

下方為各次修改的歷史驗證，包含已移除的提領率探索。

# 欄位對齊與名詞提示（2026-10-18）

- 雙欄欄位共用標題列高度，標題換行、百分比單位及固定通膨的「不適用」狀態均保持輸入區對齊。驗證台幣／美元的四種通膨模式、兩組策略參數、費用及 VCMM 欄位，包含 320px 窄畫面。
- 專有名詞旁加入「!」說明，支援滑鼠停留、鍵盤聚焦、手機點按、Escape／外部點按關閉；提示不會觸發表單送出，並隨捲動維持在可見範圍。
- 語法與可選單檔生成檢查通過，44 項計算／Worker／資料測試通過；同一次完整桌面／Pixel 7 瀏覽器回歸 **35 通過、1 略過**（既有手機 100k 案例）。新增互動案例另連續三輪通過。

# v1.3.1 回歸驗證（2026-10-17）

- 語法檢查通過，計算／Worker／資料測試 **44/44** 通過。3 項新增回歸先在舊程式失敗，再於修正後通過，涵蓋相同股票路徑、零波動通膨等價、資料尾端及缺月權重。
- 同一次完整桌面／Pixel 7 瀏覽器測試 **31 通過、1 略過**；略過手機 100k。展開進階費用、唯讀內建參數、自訂保存、圖表、比較、搜尋與下載均可用。
- 獨立檢查工具 12 項通過、0 項未解發現，完整數值見 [修正後稽核](calculation-audit-fixed-2026-10-17.json)。保留 [修正前稽核](calculation-audit-2026-10-17.json) 作對照。
- 額外以真實 Chromium 桌面與手機操作 TWD／MSCI／50 年／10k：固定通膨及零波動隨機通膨的全部數值結果逐項相同，均耗盡 2,495 條；CPI 24 個月模式耗盡 2,184 條。JSON 確認產品版 1.3.1、情境版 2026-10-17.2 及邊界處理資訊，pageerror 均為 0。
- 已人工檢視 [桌面](screenshots/v1.3.1-desktop.png)、[手機](screenshots/v1.3.1-mobile.png) 及 [手機支出圖](screenshots/v1.3.1-mobile-spending.png)，未見溢出、遮擋或無法閱讀的文字。
- 引擎更改後另跑 Node benchmark：10k 約 0.310 秒、100k 約 3.086 秒，150 點搜尋約 1.280 秒。數字為單次本機 Node 測量，非瀏覽器效能保證。

下方為前一版本的驗證紀錄。

# v1.3 回歸驗證（2026-10-17）

- 語法檢查及 41 項 Node／Worker／資料測試通過。新增已知複利校準、原始月資料排除、唯讀情境正規化、CPI 摘要與實際抽樣的區分。
- 桌面及 Pixel 7 尺寸共 31 項瀏覽器案例通過，手機 100k 依既有設定略過。完整執行後，修正兩項舊的數字顯示斷言，再重跑其所在的 6 項案例；最後自訂草稿與小數編輯調整後，另重跑 10 項新情境案例，均通過。未把分批通過描述為同一次完整執行。
- 覆蓋 MSCI／VCMM 灰色唯讀、自訂報酬與通膨逐字輸入小數、切換及重載、TWD／USD 預設、舊設定遷移、股票／CPI 方法標示、實際模擬與 JSON／CSV 完整精度及來源版本；測試使用 GitHub Pages 子路徑。
- MSCI 官方下載檔的 356 個連續月報酬已獨立核對，兩套統計實算差異小於 1e-12；同檔近十年的簡單報酬與波動四捨五入後符合官方 Net factsheet。來源與原檔雜湊見 [查核紀錄](MSCI_PARAMETER_RESEARCH.md)，原始月序列留在忽略目錄。
- Codex 實際瀏覽器另完成 TWD、MSCI 參數、固定通膨、50 年 × 10k 模擬，畫面回報約 0.69 秒。這是單次 smoke test，非速度保證。
- Node benchmark：10k 約 0.300 秒、100k 約 2.901 秒、150 點搜尋約 1.264 秒；詳見 [Node 紀錄](benchmark-node.json)，未當成瀏覽器測時。
- 可選單檔生成後，主程式及 Worker 語法檢查通過。已人工檢視[桌面唯讀欄位](screenshots/v1.3-locked-vcmm.png)與[手機 CPI 摘要](screenshots/v1.3-cpi-mobile.png)。
- v1.3 已正式發布；[發布流程](https://github.com/njames741/retirement-monte-carlo/actions/runs/39043074090) 重跑 41 項計算／資料及 31 項瀏覽器測試通過，手機 100k 依原設定略過。公開網址另確認版本、MSCI／通膨唯讀欄位及 50 年 × 10k 模擬，畫面回報約 1.09 秒、耗盡 2,495 條，與本機相同條件一致。[線上畫面](screenshots/github-pages-v1.3.png)及部署來源見 [RELEASE](RELEASE.md)。

下方保留舊版當時的驗證及資料狀態；MSCI 參數目前已完成，股票歷史月份重抽仍屬後續範圍。

# v1.2 回歸驗證（2026-10-17）

- 語法檢查與 37 項 Node／Worker／幣種／官方資料測試通過。
- 桌面及手機瀏覽器共 15 項通過、1 項依原設定略過（手機 100k 記憶體／效能未驗證）。覆蓋 Pages 子路徑、四策略切換、隱藏無效欄位、TWD／USD 預設與遷移、兩地 CPI、VCMM、下載、150 點搜尋及桌面 100k 取消重跑。
- 另以全新 TWD 設定檢查 1440×1000 及 390×844：表單標籤 16px、說明 14px，均無橫向溢出、無 pageerror，年度生活費 NT$1,200,000。已人工檢視桌面及手機截圖。
- [桌面 v1.2](screenshots/desktop-v1.2.png)／[手機 v1.2](screenshots/mobile-v1.2.png)。
- 可選單檔生成器已納入幣種及內建 CPI，生成的主程式／Worker 均通過語法檢查。
- 美國 CPI 的 2025-10 缺值保留，測試確認不計算跨缺月的單月變動、區塊在缺口重啟。
- 完整 MSCI 月序列仍缺可發布資料；股票歷史抽樣停用，issue #4 保持追蹤。沒有把合成 QA 數字當作產品資料。

正式 GitHub Pages 的 v1.2 已另外通過線上 smoke test：台幣預設、美元切換、策略細節、內建 CPI 運算及資料來源表格正常，pageerror 為零。[公開頁面截圖](screenshots/github-pages-v1.2.png)，[發布作業成功](https://github.com/njames741/retirement-monte-carlo/actions/runs/39026526081)。

下方為 v1.1 的原始驗證紀錄，保留其當時結果及限制。

# QA 紀錄（2026-10-17）

## 結論

本機可試用；完整 Git 歷史與原始碼已保存至公開 GitHub。**已依使用者進一步要求公開於 [GitHub Pages](https://njames741.github.io/retirement-monte-carlo/)**。既有 Sites 本次未操作。

## 自動化驗證

- `npm test`：**32/32 通過**（31 項引擎／CSV 測試、1 項正式 production Worker 協議整合測試）。
- `npm run check`：正式模組、scripts、tests、Playwright config 全部語法通過。
- GitHub Actions：[最終程式驗證 c9c7bc5](https://github.com/njames741/retirement-monte-carlo/actions/runs/39023767914) 成功；前一輪 [1bd69d7](https://github.com/njames741/retirement-monte-carlo/actions/runs/39023444897) 也成功。
- 真正 Chromium 瀏覽器回歸：**9 passed、1 skipped**。桌面 5 項、手機尺寸 4 項；手機 100k 測試刻意跳過，viewport 模擬無法證明實體手機記憶體足夠。測試 artifacts 含 screenshot／失敗時 trace。
- Node Worker shim 測試與 Chromium 回歸分開記錄；未混用成瀏覽器成績。

文件與畫面 commit `0f6e959` 的重跑曾在 100k 測試遇到預設 5 秒 assertion timeout，當時實際 Worker 已進到 85% 百分位計算，沒有產品錯誤。此完成等待已改為 45 秒；這不是 5 秒效能承諾，也沒有用 retry 隱藏失敗。其餘 8 個瀏覽器測試當輪通過。最新版本以 [Checks 工作流程的終態](https://github.com/njames741/retirement-monte-carlo/actions/workflows/ci.yml) 為準。

研究測試包含種子、年初提領、實付上限、零提領、最後一年耗盡、CPI 購買力、對數／幾何／算術期望、費用只扣一次與 ETF NAV 例外、Stationary 幾何區塊及循環、IID、CPI 同索引、混合欄位月份對齊、GK 嚴格門檻及最後 15 年、動態上下限、分位及 Wilson、可手算網格、VCMM 銜接、CSV 單位／日期／缺月等。

新增 GK 非單調案例存在 6 處成功率局部回升；搜尋仍逐點掃完 150 點，與獨立逐點 oracle 一致。數值溢位測試先重現直方圖 TypeError，再確認現在回明確的數值範圍錯誤。快取命中也測非法策略拒絕。

## 實際瀏覽器操作

環境：Windows x64、Codex in-app browser、Chromium/Chrome 155.0.0.0、Intel i7-12700KF、回報 20 logical processors；桌面 viewport 1280×720。未設定 CPU throttling。手機為同瀏覽器 390×844 viewport，另有 CI Pixel 7 emulation；沒有實體手機測時或 Safari／Firefox 驗證。

| 功能 | 實測結果 |
|---|---|
| 預設 50 年、4%、10k | 可由預設表單直接執行；耗盡 4,304/10,000，與 Node 一致 |
| 四策略 | fixed、percent、GK、dynamic 各自跑完；固定比例 0% 耗盡仍只有約 21.9% 雙重成功，指標有區分 |
| 100k、取消、重跑 | 開始後可停止；保留舊結果、新建 Worker 重跑完成，耗盡 42,950/100,000，與 Node 一致 |
| 報酬／通膨 | 自訂參數、歷史 Stationary／IID、自訂歷史漂移及 VCMM；固定、獨立隨機、歷史同步 CPI 均跑完 |
| 圖表 | hover 年值、點擊釘選離開仍顯示、方向鍵、Escape、年度滑桿、顯示期間、對數、P1/P99、最好／最差；直方圖與耗盡年 tooltip 可用 |
| CSV 格式 | 缺月拒絕，合法合成資料讀入；資料明標 SYNTHETIC QA ONLY，不當市場觀察值 |
| 保存與清除 | 重新載入後 IndexedDB 資料仍在；清除後再載入確定移除；參數及生活費成功底線亦保存 |
| 換 CSV | 先含 CPI、再換無 CPI，正確改回固定通膨；合法換檔會清除舊校驗錯誤 |
| 下載 | 空白 CSV 模板、年度 CSV、研究 JSON 均實際下載；年度 CSV 52 列（含 header、年0–50）、15 欄、無 NaN/Infinity；JSON 有真實結果、設定及環境、無原始 returns/dates |
| 比較 | 四策略共用市場；無資料時 2 種報酬情境，有資料時 3 種情境 |
| 搜尋 | 完整 150 點，預設條件最高通過網格 1.5%；非連續最優或未來保證 |
| 響應式 | 桌面及 390px 手機無橫向頁面溢出；手機抽屜可開、執行後關閉、可重跑與切頁籤 |
| 子路徑 | 在 /retirement-monte-carlo/ 真正操作；CI 額外檢查 app/data/engine/charts/style/worker 相對資源；沒有依賴根路徑 |
| Console | 本機完成操作後無 error／warn |

## 本次修正

1. 初始資產 `min=1, step=10000` 使預設 1,000,000 不合法，瀏覽器擋住 submit；改成整數 step，並保留表單提交回歸。
2. 改參數時保留舊結果的原始金額與年數標籤，避免新標籤混舊數字；狀態提示需重跑。
3. 縮短顯示年數會同步限制滑桿及年度標籤；輸入立即重畫。
4. 成功條件設定亦保存；修正換 CSV 後殘留 CPI 模式及舊錯誤。
5. Worker 快取命中仍驗證；快取計時不再冒稱重新生成市場。
6. CSV 水準比值及跨年累積非有限值明確拒絕；期末平均採先除後加，降低總和溢位。
7. 移除外部字型請求，網站只使用系統字型及本機模組；更新非條件式「年初必定較保守」等方法文字。

## 實際效能

下列為本機實測，不是通用速度保證。完整 JSON 見 [browser](benchmark-browser.json) 與 [Node](benchmark-node.json)。兩次完整模擬皆從新市場開始（marketCached=false）；時間由 Worker 自身 performance.now 計量，包含市場生成及完整摘要，排除畫面繪製、下載、工具往返時間。

| 執行環境／操作 | 時間 |
|---|---:|
| 瀏覽器 50 年 × 10k 完整模擬 | **0.530 秒**（市場 0.383 秒） |
| 瀏覽器 50 年 × 100k 完整模擬 | **7.261 秒**（市場 5.814 秒） |
| 瀏覽器 10k × 150 點搜尋，包含重新生成市場 | **約 1.68 秒**（介面精度 0.01 秒） |
| Node 24.20.0、10k 完整模擬 | 0.290 秒 |
| Node 24.20.0、100k 完整模擬 | 2.909 秒 |
| Node 10k × 150 點搜尋，市場已備妥 | 1.227 秒 |

相同預設及 seed=741，兩環境的耗盡數及生活費成功率一致。先前 100k 瀏覽器量測為 5.269 秒；當時尚未加最後數值邊界檢查，且單次速度受 host 負載與 JIT 影響，不將差異全歸因於程式。保留原記錄，不取較快的一次冒充最終版本。

## 環境與發布限制

- 沙箱內 listener 雖顯示啟動，fetch 回 EACCES／逾時、瀏覽器無法連到；沙箱外相同 server 在 127.0.0.1 成功。GitHub CLI 憑證也需沙箱外讀 keyring，原登入仍有效。
- 本次 CSV「upload」是工具對本機選檔的名稱；產品使用 File API、IndexedDB，沒有 POST／上傳 API，也沒有將測試資料傳往網際網路。
- 前階段 Pages API 回 404；本次依使用者要求啟用 build_type=workflow，[發布 run](https://github.com/njames741/retirement-monte-carlo/actions/runs/39024556102) 成功。真正公開網址的 10k 模擬、P1/P99、對數、年度滑桿、CSV 下載均通過，console 無 error／warn；後續仍手動發布。
- 未取得 MSCI 完整可重分發月資料。無債券、多資產、台灣 CPI、TWD、個人稅、快照匯入；Vanguard 參考引用方式仍需公開前確認（見 THIRD_PARTY_NOTICES）。
- 未驗證實體手機 100k 記憶體峰值及跨瀏覽器；可選單檔 HTML 也沒有另做瀏覽器驗證。主要可用產品為模組化 dist/。

## 畫面證據

[桌面完整畫面](screenshots/desktop.png) · [桌面預覽](screenshots/desktop-preview.png) · [手機完整畫面](screenshots/mobile.png)

## 首次公開發布後驗證

- 日期：2026-10-17；部署 commit `ced5918`，verify／deploy 均成功。
- 公開網址：https://njames741.github.io/retirement-monte-carlo/
- 50 年 × 10k，seed 741，瀏覽器約 0.52 秒；耗盡 43.0%、雙重成功 57.0%。這是另外一次公開頁面 smoke test，未取代前述完整效能紀錄。
- module Worker、互動圖表與 CSV 下載正常；沒有重新匯入或上傳任何歷史 CSV。
- [公開頁面畫面](screenshots/github-pages.png)。
