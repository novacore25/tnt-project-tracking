# Graph Report - Project-Tracking-System  (2026-09-15)

## Corpus Check
- Large corpus: 499 files · ~545,371 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 1721 nodes · 2847 edges · 281 communities (104 shown, 165 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.84)
- Token cost: 15,000 input · 800 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
- Community 108
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113
- Community 114
- Community 115
- Community 116
- Community 117
- Community 118
- Community 119
- Community 120
- Community 121
- Community 122
- Community 123
- Community 124
- Community 125
- Community 126
- Community 127
- Community 128
- Community 129
- Community 130
- Community 131
- Community 132
- Community 133
- Community 134
- Community 135
- Community 136
- Community 137
- Community 138
- Community 139
- Community 140
- Community 141
- Community 142
- Community 143
- Community 144
- Community 145
- Community 146
- Community 147
- Community 148
- Community 149
- Community 150
- Community 151
- Community 152
- Community 153
- Community 154
- Community 155
- Community 156
- Community 157
- Community 158
- Community 159
- Community 160
- Community 161
- Community 162
- Community 163
- Community 164
- Community 165
- Community 166
- Community 167
- Community 168
- Community 169
- Community 170
- Community 171
- Community 172
- Community 173
- Community 174
- Community 175
- Community 176
- Community 177
- Community 178
- Community 179
- Community 180
- Community 181
- Community 182
- Community 183
- Community 184
- Community 185
- Community 186
- Community 187
- Community 188
- Community 189
- Community 190
- Community 191
- Community 192
- Community 193
- Community 194
- Community 195
- Community 196
- Community 197
- Community 198
- Community 199
- Community 200
- Community 201
- Community 202
- Community 203
- Community 204
- Community 205
- Community 206
- Community 207
- Community 208
- Community 209
- Community 210
- Community 211
- Community 212
- Community 213
- Community 214
- Community 215
- Community 216
- Community 217
- Community 218
- Community 219
- Community 220
- Community 221
- Community 222
- Community 223
- Community 224
- Community 225
- Community 226
- Community 227
- Community 228
- Community 229
- Community 230
- Community 231
- Community 232
- Community 233
- Community 234
- Community 235
- Community 236
- Community 237
- Community 238
- Community 240
- Community 241
- Community 242
- Community 243
- Community 244
- Community 246
- Community 247
- Community 250
- Community 255
- Community 256
- Community 257
- Community 258
- Community 259
- Community 260
- Community 261
- Community 262
- Community 263
- Community 265
- Community 266
- Community 267
- Community 268
- Community 269
- Community 270
- Community 271
- Community 272
- Community 273
- Community 274
- Community 275
- Community 276
- Community 277

## God Nodes (most connected - your core abstractions)
1. `@supabase/supabase-js` - 178 edges
2. `react` - 86 edges
3. `useDatabaseStore` - 63 edges
4. `lucide-react` - 62 edges
5. `createClient()` - 60 edges
6. `createClient()` - 46 edges
7. `useAuth()` - 42 edges
8. `dotenv` - 31 edges
9. `cn()` - 27 edges
10. `BatchDetail()` - 26 edges

## Surprising Connections (you probably didn't know these)
- `CampaignFilterContextWrapper()` --calls--> `useDatabaseStore`  [EXTRACTED]
  web-app/src/app/campaigns/[id]/layout.tsx → web-app/src/store/useDatabaseStore.ts
- `InputPenjualanPage()` --calls--> `useAuth()`  [EXTRACTED]
  web-app/src/app/input-penjualan/page.tsx → web-app/src/providers/AuthProvider.tsx
- `LoginPage()` --calls--> `createClient()`  [EXTRACTED]
  web-app/src/app/login/page.tsx → web-app/src/utils/supabase/client.ts
- `DialogOverlay` --calls--> `cn()`  [EXTRACTED]
  web-app/src/components/ui/Dialog.tsx → web-app/src/utils/cn.ts
- `ActivityLogPage()` --calls--> `useAuth()`  [EXTRACTED]
  web-app/src/app/activity-log/page.tsx → web-app/src/providers/AuthProvider.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **TNT Logo Composition** — web_app_public_icon_tnt_project_tracking1_logo, web_app_public_icon_tnt_project_tracking1_tnt_text, web_app_public_icon_tnt_project_tracking1_network_traces [EXTRACTED 1.00]

## Communities (281 total, 165 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (68): getAdsReportData(), GlobalBudgetingContent(), supabase, addPaymentItem(), autoSplitUnpaidBatchItems(), bulkApproveExecutive1(), bulkApproveExecutiveFinal(), bulkApproveManager() (+60 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (43): papaparse, AddressSyncModal(), supabase, BudgetSyncModal(), CampaignSyncModal(), supabase, CreatorSyncModal(), supabase (+35 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (17): supabase, @supabase/supabase-js, { createClient }, supabase, { createClient }, supabase, { createClient }, supabase (+9 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (31): supabase, DatabaseState, supabase, AdNameMapping, AdsPerformance, AdsSpend, AuditLog, Brand (+23 more)

### Community 4 - "Community 4"
Cohesion: 0.11
Nodes (17): lucide-react, AdsImport(), FileConfig, SearchableSelect(), CreatorGMV, OrganicImport(), PreviewRow, PreviewStats (+9 more)

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (17): metadata, PendingPage(), SkuPage(), DataLoader(), LayoutWrapper(), NotesTimelineProps, TimelineNote, SearchableSelect() (+9 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (15): pg, { Pool }, { createClient }, { Pool }, { Client }, { Client }, { Client }, env (+7 more)

### Community 7 - "Community 7"
Cohesion: 0.29
Nodes (17): supabase, MemoizedTableRow, supabase, Badge(), BadgeProps, Card, CardContent, CardDescription (+9 more)

### Community 8 - "Community 8"
Cohesion: 0.11
Nodes (18): BudgetingAdsPage(), AdsReportPage(), CampaignConceptsPage(), supabase, CampaignCardItem(), CampaignsPage(), AddCreatorClient(), DragFillState (+10 more)

### Community 9 - "Community 9"
Cohesion: 0.20
Nodes (14): @supabase/ssr, addWhitelistEmail(), approveUser(), assignCampaignsToUser(), changeUserRole(), deactivateUser(), getSupabaseAdmin(), rejectUser() (+6 more)

### Community 10 - "Community 10"
Cohesion: 0.13
Nodes (14): getLivestreamData(), supabase, CampaignFilterContextWrapper(), CampaignLayoutInner(), LiveSchedulePage(), supabase, CampaignLiveStreamClient(), CampaignLiveStreamPage() (+6 more)

### Community 11 - "Community 11"
Cohesion: 0.19
Nodes (15): CreatorRow, CreatorRowProps, CampaignListingContent(), extractCampaignSnapshot(), supabase, CreatorProfilePage(), supabase, NotesTimeline() (+7 more)

### Community 12 - "Community 12"
Cohesion: 0.10
Nodes (20): clsx, eslint, eslint-config-next, @radix-ui/react-dialog, react-dom, swr, tailwind-merge, tailwindcss (+12 more)

### Community 13 - "Community 13"
Cohesion: 0.10
Nodes (21): dependencies, clsx, dotenv, exceljs, file-saver, lucide-react, next, papaparse (+13 more)

### Community 14 - "Community 14"
Cohesion: 0.11
Nodes (19): cheerio, author, dependencies, cheerio, xlsx, description, xlsx, keywords (+11 more)

### Community 15 - "Community 15"
Cohesion: 0.10
Nodes (8): dotenv, supabase, run(), supabase, supabase, supabase, supabase, supabase

### Community 16 - "Community 16"
Cohesion: 0.10
Nodes (19): action, default_icon, default_popup, background, service_worker, content_scripts, 128, 16 (+11 more)

### Community 18 - "Community 18"
Cohesion: 0.16
Nodes (14): BatchUpdateData, batchUpdateResiByClient(), getPortalData(), loginPortal(), logoutPortal(), submitClientApproval(), supabase, updateClientNotes() (+6 more)

### Community 19 - "Community 19"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 20 - "Community 20"
Cohesion: 0.28
Nodes (16): addCurrentToQueue(), appDatabase, formatFollowers(), getTier(), init(), isInDatabase(), isInQueue(), loadAppDatabase() (+8 more)

### Community 21 - "Community 21"
Cohesion: 0.17
Nodes (6): react, CampaignDailyPerformanceClient(), supabase, toWIBDateStr(), TimelineTarget(), TimelineTargetProps

### Community 22 - "Community 22"
Cohesion: 0.24
Nodes (11): getInternalVideoData(), supabase, CampaignVideoPage(), dynamic, revalidate, CampaignVideoPage(), extractGDriveId(), extractTikTokUploadDate() (+3 more)

### Community 23 - "Community 23"
Cohesion: 0.15
Nodes (12): action, default_popup, default_title, background, service_worker, content_scripts, description, host_permissions (+4 more)

### Community 24 - "Community 24"
Cohesion: 0.26
Nodes (9): exceljs, file-saver, dynamic, SummaryPage(), ExcelExportButton(), Props, fetchAll(), fetchReportData() (+1 more)

### Community 25 - "Community 25"
Cohesion: 0.26
Nodes (11): { createClient }, getOrCreateBrand(), getOrCreateCampaign(), parseApproval(), parseGMV(), parsePrice(), processAll(), processSheet() (+3 more)

### Community 26 - "Community 26"
Cohesion: 0.24
Nodes (7): ActivityLogPage(), AlamatPage(), CampaignPerformaClient(), supabase, CreatorPoolPage(), supabase, exportToCSV()

### Community 27 - "Community 27"
Cohesion: 0.36
Nodes (9): deleteBatchSkusAction(), deleteSkuAction(), getCampaignSkus(), saveBatchSkusAction(), SkuInput, supabase, updateSkuAction(), SkuPage() (+1 more)

### Community 28 - "Community 28"
Cohesion: 0.20
Nodes (10): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/file-saver, @types/node, @types/react (+2 more)

### Community 29 - "Community 29"
Cohesion: 0.20
Nodes (7): allCreators, diffs, legacy, raw1, raw2, rawCreators, xlsx

### Community 30 - "Community 30"
Cohesion: 0.20
Nodes (7): allCreators, diffs, legacy, raw1, raw2, rawCreators, xlsx

### Community 31 - "Community 31"
Cohesion: 0.39
Nodes (7): getStatValue(), injectButton(), updatePreview(), isKalodata, observer, scrapeData(), scrapeKalodata()

### Community 32 - "Community 32"
Cohesion: 0.28
Nodes (8): dataPath, fileBudgeting, fileListing, fileTracking, findHeaderRow(), normalizeStr(), runRelationsMigration(), supabase

### Community 33 - "Community 33"
Cohesion: 0.31
Nodes (8): { createClient }, parseAudienceAge(), parseGMV(), parsePrice(), run(), sheetMapping, supabase, XLSX

### Community 34 - "Community 34"
Cohesion: 0.33
Nodes (6): determineContentType(), DragFillState, getEmptyRow(), parseSmartNumber(), SpreadsheetImportCreatorClient(), SpreadsheetRow

### Community 35 - "Community 35"
Cohesion: 0.39
Nodes (7): dataPath, fileListing, findHeaderRow(), normalizeLink(), normalizePhone(), normalizeUsername(), runAudit()

### Community 36 - "Community 36"
Cohesion: 0.29
Nodes (7): dataPath, fileBudgeting, fileListing, fileTracking, findDifferences(), normalizeStr(), supabase

### Community 37 - "Community 37"
Cohesion: 0.32
Nodes (7): dataPath, fileListing, fileTracking, findHeaderRow(), fixCampaigns(), normalizeStr(), supabase

### Community 38 - "Community 38"
Cohesion: 0.29
Nodes (7): dataPath, fileListing, fixIswhite(), normalizeStr(), require, supabase, XLSX

### Community 39 - "Community 39"
Cohesion: 0.32
Nodes (7): dataPath, fileListing, fileTracking, findHeaderRow(), normalizeStr(), runMigration(), supabase

### Community 40 - "Community 40"
Cohesion: 0.29
Nodes (7): { createClient }, dotenv, fs, mapCampaign(), run(), supabase, XLSX

### Community 41 - "Community 41"
Cohesion: 0.29
Nodes (7): dataPath, fileBudgeting, fileListing, fileTracking, normalizeStr(), supabase, validate()

### Community 42 - "Community 42"
Cohesion: 0.29
Nodes (6): data, newKeySet, oldKeySet, OMG_MAKEUP_SKUS, workbook, XLSX

### Community 43 - "Community 43"
Cohesion: 0.29
Nodes (6): approvals, data, parsedData, rows, workbook, xlsx

### Community 44 - "Community 44"
Cohesion: 0.38
Nodes (6): dataPath, fileListing, findHeaderRow(), fixCampaignsFast(), normalizeStr(), supabase

### Community 45 - "Community 45"
Cohesion: 0.29
Nodes (6): approved, data, parsedData, rows, workbook, xlsx

### Community 46 - "Community 46"
Cohesion: 0.33
Nodes (6): { createClient }, parseApproval(), run(), sheetMapping, supabase, XLSX

### Community 47 - "Community 47"
Cohesion: 0.29
Nodes (6): bdContent, bdFile, ccContent, ccFile, fs, path

### Community 48 - "Community 48"
Cohesion: 0.38
Nodes (4): DragFillState, getEmptyRow(), SpreadsheetImportAddressClient(), SpreadsheetRow

### Community 49 - "Community 49"
Cohesion: 0.33
Nodes (5): supabase, MultiSelect(), MultiSelectProps, Option, CreatorAddress

### Community 50 - "Community 50"
Cohesion: 0.33
Nodes (3): ColumnMapping, EnrichedAdsRow, ParsedAdsRow

### Community 51 - "Community 51"
Cohesion: 0.33
Nodes (4): dom, fs, html, { JSDOM }

### Community 52 - "Community 52"
Cohesion: 0.33
Nodes (5): basePath, files, fs, path, XLSX

### Community 53 - "Community 53"
Cohesion: 0.40
Nodes (5): dataPath, fileListing, findSpecificDiffs(), normalizeStr(), supabase

### Community 54 - "Community 54"
Cohesion: 0.40
Nodes (5): dataPath, fileBudgeting, normalizeStr(), runFinanceMigration(), supabase

### Community 55 - "Community 55"
Cohesion: 0.33
Nodes (5): data, parsedData, rows, workbook, xlsx

### Community 56 - "Community 56"
Cohesion: 0.33
Nodes (5): fs, grouped, rows, workbook, XLSX

### Community 58 - "Community 58"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, start

### Community 59 - "Community 59"
Cohesion: 0.40
Nodes (4): content1, file1, fs, path

### Community 60 - "Community 60"
Cohesion: 0.40
Nodes (4): data, uniqueVideos, workbook, xlsx

### Community 61 - "Community 61"
Cohesion: 0.40
Nodes (3): { createClient }, fs, supabase

### Community 62 - "Community 62"
Cohesion: 0.40
Nodes (3): fs, path, XLSX

### Community 63 - "Community 63"
Cohesion: 0.40
Nodes (4): brands, data, workbook, xlsx

### Community 64 - "Community 64"
Cohesion: 0.50
Nodes (4): checkCount(), { createClient }, run(), supabase

### Community 65 - "Community 65"
Cohesion: 0.40
Nodes (4): data, wardahRows, workbook, xlsx

### Community 66 - "Community 66"
Cohesion: 0.50
Nodes (4): checkColumns(), { createClient }, run(), supabase

### Community 67 - "Community 67"
Cohesion: 0.40
Nodes (3): fs, path, XLSX

### Community 68 - "Community 68"
Cohesion: 0.50
Nodes (4): dataPath, fileListing, findDupesInSheet(), normalizeStr()

### Community 69 - "Community 69"
Cohesion: 0.40
Nodes (3): { createClient }, supabase, xlsx

### Community 70 - "Community 70"
Cohesion: 0.40
Nodes (3): { createClient }, supabase, xlsx

### Community 71 - "Community 71"
Cohesion: 0.50
Nodes (4): fileListing, fixContactsAndSnapshots(), normalizeStr(), supabase

### Community 72 - "Community 72"
Cohesion: 0.50
Nodes (4): { createClient }, parseTikTokDate(), run(), supabase

### Community 73 - "Community 73"
Cohesion: 0.40
Nodes (3): { createClient }, supabase, xlsx

### Community 74 - "Community 74"
Cohesion: 0.50
Nodes (4): fileListing, fixVideos(), normalizeStr(), supabase

### Community 75 - "Community 75"
Cohesion: 0.50
Nodes (4): fileBudgeting, normalizeStr(), runFinanceMigrationFast(), supabase

### Community 76 - "Community 76"
Cohesion: 0.40
Nodes (3): { createClient }, supabase, xlsx

### Community 77 - "Community 77"
Cohesion: 0.40
Nodes (4): content, file, fs, path

### Community 78 - "Community 78"
Cohesion: 0.50
Nodes (4): { createClient }, levenshteinDistance(), run(), supabase

### Community 79 - "Community 79"
Cohesion: 0.40
Nodes (3): { createClient }, supabase, xlsx

### Community 80 - "Community 80"
Cohesion: 0.40
Nodes (3): { createClient }, supabase, xlsx

### Community 81 - "Community 81"
Cohesion: 0.40
Nodes (3): { createClient }, fs, path

### Community 82 - "Community 82"
Cohesion: 0.40
Nodes (3): anonKey, envFile, supabase

### Community 83 - "Community 83"
Cohesion: 0.40
Nodes (3): anonKey, envFile, supabase

### Community 84 - "Community 84"
Cohesion: 0.40
Nodes (3): anonKey, envFile, supabase

### Community 85 - "Community 85"
Cohesion: 0.40
Nodes (3): anonKey, envFile, supabase

### Community 86 - "Community 86"
Cohesion: 0.40
Nodes (3): anonKey, envFile, supabase

### Community 87 - "Community 87"
Cohesion: 0.40
Nodes (3): { createClient }, dotenv, supabase

### Community 88 - "Community 88"
Cohesion: 0.40
Nodes (3): { createClient }, dotenv, supabase

### Community 89 - "Community 89"
Cohesion: 0.40
Nodes (3): anonKey, envFile, supabase

### Community 90 - "Community 90"
Cohesion: 0.40
Nodes (3): anonKey, envFile, supabase

### Community 91 - "Community 91"
Cohesion: 0.60
Nodes (4): findHeaderRow(), normalizeStr(), run(), xlsx

### Community 93 - "Community 93"
Cohesion: 0.83
Nodes (3): extractPartnerCenter(), parseCount(), saveData()

### Community 125 - "Community 125"
Cohesion: 0.50
Nodes (3): data, xlsx, workbook

### Community 128 - "Community 128"
Cohesion: 0.50
Nodes (3): sheets, workbook, XLSX

### Community 153 - "Community 153"
Cohesion: 0.50
Nodes (3): fs, path, tabs

### Community 162 - "Community 162"
Cohesion: 0.50
Nodes (3): data, workbook, xlsx

### Community 163 - "Community 163"
Cohesion: 0.50
Nodes (3): data, workbook, xlsx

### Community 171 - "Community 171"
Cohesion: 0.50
Nodes (3): data, workbook, xlsx

### Community 172 - "Community 172"
Cohesion: 0.50
Nodes (3): data, workbook, xlsx

### Community 173 - "Community 173"
Cohesion: 0.50
Nodes (3): fs, workbook, XLSX

### Community 174 - "Community 174"
Cohesion: 0.50
Nodes (3): data, workbook, XLSX

### Community 179 - "Community 179"
Cohesion: 0.67
Nodes (3): fs, roundImage(), sharp

### Community 211 - "Community 211"
Cohesion: 0.67
Nodes (3): getDailyData(), supabase, toWIBDateStr()

### Community 214 - "Community 214"
Cohesion: 0.67
Nodes (3): Git Commit Hook, Query, Graphify Workflow

### Community 215 - "Community 215"
Cohesion: 0.67
Nodes (3): TNT Project Tracking Logo, Network Nodes and Traces, TNT Text

## Knowledge Gaps
- **758 isolated node(s):** `isKalodata`, `manifest_version`, `name`, `version`, `description` (+753 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 996 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **165 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@supabase/supabase-js` connect `Community 2` to `Community 3`, `Community 6`, `Community 10`, `Community 12`, `Community 15`, `Community 18`, `Community 22`, `Community 25`, `Community 27`, `Community 32`, `Community 33`, `Community 36`, `Community 37`, `Community 38`, `Community 39`, `Community 40`, `Community 41`, `Community 44`, `Community 46`, `Community 53`, `Community 54`, `Community 61`, `Community 64`, `Community 66`, `Community 69`, `Community 70`, `Community 71`, `Community 72`, `Community 73`, `Community 74`, `Community 75`, `Community 76`, `Community 78`, `Community 79`, `Community 80`, `Community 81`, `Community 82`, `Community 83`, `Community 84`, `Community 85`, `Community 86`, `Community 87`, `Community 88`, `Community 89`, `Community 90`, `Community 92`, `Community 94`, `Community 95`, `Community 96`, `Community 97`, `Community 98`, `Community 99`, `Community 100`, `Community 101`, `Community 103`, `Community 104`, `Community 105`, `Community 106`, `Community 107`, `Community 108`, `Community 109`, `Community 110`, `Community 111`, `Community 112`, `Community 113`, `Community 114`, `Community 115`, `Community 116`, `Community 117`, `Community 118`, `Community 119`, `Community 120`, `Community 121`, `Community 122`, `Community 123`, `Community 126`, `Community 127`, `Community 129`, `Community 130`, `Community 131`, `Community 132`, `Community 133`, `Community 134`, `Community 135`, `Community 136`, `Community 137`, `Community 138`, `Community 139`, `Community 140`, `Community 141`, `Community 142`, `Community 143`, `Community 144`, `Community 145`, `Community 146`, `Community 147`, `Community 148`, `Community 149`, `Community 150`, `Community 151`, `Community 152`, `Community 154`, `Community 155`, `Community 156`, `Community 157`, `Community 159`, `Community 160`, `Community 161`, `Community 164`, `Community 165`, `Community 166`, `Community 167`, `Community 168`, `Community 169`, `Community 170`, `Community 175`, `Community 176`, `Community 177`, `Community 178`, `Community 180`, `Community 181`, `Community 182`, `Community 183`, `Community 184`, `Community 185`, `Community 186`, `Community 187`, `Community 188`, `Community 189`, `Community 190`, `Community 191`, `Community 192`, `Community 193`, `Community 194`, `Community 195`, `Community 196`, `Community 197`, `Community 198`, `Community 199`, `Community 200`, `Community 201`, `Community 202`, `Community 203`, `Community 204`, `Community 205`, `Community 206`, `Community 207`, `Community 208`, `Community 209`, `Community 210`, `Community 211`, `Community 225`, `Community 226`, `Community 227`, `Community 228`, `Community 229`, `Community 233`, `Community 234`, `Community 235`, `Community 236`, `Community 237`?**
  _High betweenness centrality (0.468) - this node is a cross-community bridge._
- **Why does `react` connect `Community 21` to `Community 0`, `Community 1`, `Community 4`, `Community 5`, `Community 7`, `Community 8`, `Community 9`, `Community 10`, `Community 11`, `Community 12`, `Community 18`, `Community 22`, `Community 24`, `Community 26`, `Community 27`, `Community 34`, `Community 48`, `Community 49`, `Community 212`, `Community 213`?**
  _High betweenness centrality (0.133) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `Community 4` to `Community 0`, `Community 1`, `Community 34`, `Community 5`, `Community 7`, `Community 8`, `Community 9`, `Community 10`, `Community 11`, `Community 12`, `Community 48`, `Community 49`, `Community 18`, `Community 17`, `Community 21`, `Community 22`, `Community 26`, `Community 27`?**
  _High betweenness centrality (0.118) - this node is a cross-community bridge._
- **What connects `isKalodata`, `manifest_version`, `name` to the rest of the system?**
  _758 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06837606837606838 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07948568088836938 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05555555555555555 - nodes in this community are weakly interconnected._