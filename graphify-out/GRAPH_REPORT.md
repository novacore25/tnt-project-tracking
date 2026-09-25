# Graph Report - Project-Tracking-System-VPS  (2026-09-25)

## Corpus Check
- Large corpus: 532 files · ~585,631 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 2153 nodes · 3686 edges · 317 communities (114 shown, 203 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

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
- Community 239
- Community 240
- Community 241
- Community 242
- Community 243
- Community 244
- Community 245
- Community 246
- Community 247
- Community 248
- Community 249
- Community 250
- Community 251
- Community 252
- Community 253
- Community 254
- Community 255
- Community 256
- Community 257
- Community 258
- Community 259
- Community 260
- Community 261
- Community 263
- Community 264
- Community 266
- Community 268
- Community 269
- Community 272
- Community 273
- Community 279
- Community 280
- Community 283
- Community 292
- Community 299
- Community 301

## God Nodes (most connected - your core abstractions)
1. `useDatabaseStore` - 97 edges
2. `react` - 92 edges
3. `lucide-react` - 66 edges
4. `useAuth()` - 50 edges
5. `auth` - 37 edges
6. `drizzle-orm` - 34 edges
7. `dotenv` - 32 edges
8. `CampaignListingContent()` - 28 edges
9. `DB` - 28 edges
10. `campaigns` - 28 edges

## Surprising Connections (you probably didn't know these)
- `get_campaign_performance()` --reads_from--> `campaign_creators`  [EXTRACTED]
  db_rpc_get_campaign_performance.sql → web-app/supabase/migrations/20260610000000_phase_1.sql
- `get_campaign_performance()` --reads_from--> `campaigns`  [EXTRACTED]
  db_rpc_get_campaign_performance.sql → web-app/supabase/migrations/20260610000000_phase_1.sql
- `get_campaign_performance()` --reads_from--> `creators`  [EXTRACTED]
  db_rpc_get_campaign_performance.sql → web-app/supabase/migrations/20260610000000_phase_1.sql
- `get_campaign_performance()` --reads_from--> `videos`  [EXTRACTED]
  db_rpc_get_campaign_performance.sql → web-app/supabase/migrations/20260610000000_phase_1.sql
- `get_campaign_performance()` --reads_from--> `sales`  [EXTRACTED]
  db_rpc_get_campaign_performance.sql → web-app/supabase/migrations/20260610000001_phase_2.sql

## Import Cycles
- None detected.

## Communities (317 total, 203 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (71): GlobalBudgetingContent(), addPaymentItem(), autoSplitUnpaidBatchItems(), bulkApproveExecutive1(), bulkApproveExecutiveFinal(), bulkApproveManager(), bulkMarkPaidFinance(), bulkProcessFinanceReview() (+63 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (63): executeAdsImportAction(), executeSalesImportAction(), executeSalesImportChunkAction(), fetchAdNameMappingsAction(), fetchImportMetadataAction(), finishSalesImportAction(), insertCustomSkuAction(), saveAdNameMappingAction() (+55 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (62): addCampaignConceptAction(), batchDeleteCampaignCreatorsAction(), batchUpdateCampaignCreatorsApprovalAction(), bulkInsertVideosAction(), bulkVerifyVideoLinksAction(), commitBulkImportVideosAction(), deleteCampaignConceptAction(), deleteSingleDuplicateCampaignCreatorAction() (+54 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (40): addAdsSpendAction(), addAuditLogAction(), addCampaignCreatorAction(), addCreatorFullAction(), addCreatorNoteAction(), addCreatorSnapshotAction(), addDailyPerformanceAction(), addLiveScheduleAction() (+32 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (27): bulkAutoDetectAddressCreatorsAction(), fetchCampaignCreatorsForAddressAction(), fetchCreatorAddressBookAction(), importSpreadsheetAddressesAction(), saveAddressDetailsAction(), syncMissingCampaignAddressesAction(), fetchLivePageDataAction(), fetchPerformaPageFullDataAction() (+19 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (38): campaign_creator_notes, accounts, adNameMapping, adsPerformance, adsSpends, adsTopups, auditLogs, brands (+30 more)

### Community 6 - "Community 6"
Cohesion: 0.19
Nodes (22): bulkSyncBudgetRows(), BudgetSyncModal(), Badge(), BadgeProps, Card, CardContent, CardDescription, CardHeader (+14 more)

### Community 7 - "Community 7"
Cohesion: 0.10
Nodes (29): addCreatorNote(), addCreatorSnapshot(), bulkImportCreatorsAction(), fetchCreatorProfile(), fetchCreatorsPaginated(), fetchStaffProfiles(), updateCreatorContact(), updateCreatorMaster() (+21 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (11): lucide-react, react, importLiveOrganicAction(), LiveSyncModal(), parseRp(), Button, ButtonProps, DialogContent (+3 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (15): pg, { Pool }, { createClient }, { Pool }, { Client }, { Client }, { Client }, env (+7 more)

### Community 10 - "Community 10"
Cohesion: 0.14
Nodes (21): papaparse, syncAddressBatchAction(), searchCreatorUsernames(), executeFullCampaignSyncAction(), fetchCampaignSyncListingDbAction(), AddressSyncModal(), CampaignSyncModal(), UsernameAutocomplete() (+13 more)

### Community 11 - "Community 11"
Cohesion: 0.11
Nodes (21): fetchActivityLogsAction(), ActivityLogPage(), deleteAdPerformanceAction(), getAdsReportData(), updateAdPerformanceAction(), AdsReportPage(), MemoizedTableRow, InputPenjualanPage() (+13 more)

### Community 12 - "Community 12"
Cohesion: 0.11
Nodes (22): public.get_campaign_creator_performance(), organic_videos, manual_video_imports, public.get_campaign_creator_performance(), organic_videos, public.get_campaign_video_stats(), organic_videos, ads_name_mappings (+14 more)

### Community 13 - "Community 13"
Cohesion: 0.07
Nodes (26): AdNameMapping, AdsPerformance, AdsSpend, AuditLog, Brand, Campaign, CampaignSummary, Creator (+18 more)

### Community 14 - "Community 14"
Cohesion: 0.11
Nodes (17): ads_import, campaign_sales_summary, public.get_campaign_live_stats(), organic_videos, brands, campaigns, public.vw_campaign_summary, public.vw_campaign_summary (+9 more)

### Community 15 - "Community 15"
Cohesion: 0.12
Nodes (20): get_campaign_sales_stats(), audit_logs, creator_contacts, creator_niches, creator_notes, creator_snapshots, creators, extract_content_uid() (+12 more)

### Community 16 - "Community 16"
Cohesion: 0.08
Nodes (23): clsx, eslint, eslint-config-next, exceljs, postgres, @radix-ui/react-dialog, react-dom, swr (+15 more)

### Community 17 - "Community 17"
Cohesion: 0.16
Nodes (18): bulkAutoDetectCreatorsAction(), executeSpreadsheetImportAction(), verifySpreadsheetCreatorsAction(), DragFillState, getEmptyRow(), SpreadsheetImportClient(), SpreadsheetRow, CreatorSyncModal() (+10 more)

### Community 18 - "Community 18"
Cohesion: 0.09
Nodes (9): dotenv, supabase, run(), supabase, supabase, supabase, supabase, supabase (+1 more)

### Community 19 - "Community 19"
Cohesion: 0.18
Nodes (9): drizzle-orm, getTikTokAuthStatusAction(), getTikTokSyncHistoryAction(), dynamic, revalidate, ManajemenAkunPage(), TikTokSyncControlCard(), DB (+1 more)

### Community 20 - "Community 20"
Cohesion: 0.09
Nodes (22): dependencies, clsx, dotenv, drizzle-orm, exceljs, file-saver, lucide-react, next (+14 more)

### Community 21 - "Community 21"
Cohesion: 0.14
Nodes (14): pembayaran, vw_campaign_summary, campaign_creators, idx_cc_campaign, idx_cc_creator, videos, daily_performance, vw_campaign_summary (+6 more)

### Community 22 - "Community 22"
Cohesion: 0.10
Nodes (19): cheerio, author, dependencies, cheerio, xlsx, description, xlsx, keywords (+11 more)

### Community 23 - "Community 23"
Cohesion: 0.10
Nodes (19): action, default_icon, default_popup, background, service_worker, content_scripts, 128, 16 (+11 more)

### Community 25 - "Community 25"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 26 - "Community 26"
Cohesion: 0.28
Nodes (16): addCurrentToQueue(), appDatabase, formatFollowers(), getTier(), init(), isInDatabase(), isInQueue(), loadAppDatabase() (+8 more)

### Community 27 - "Community 27"
Cohesion: 0.25
Nodes (12): public.profiles, creator_bank_accounts, payment_batches, payment_items, sender_accounts, idx_payment_batches_paid_at, idx_payment_items_final_status, vw_payment_mutations (+4 more)

### Community 28 - "Community 28"
Cohesion: 0.12
Nodes (6): campaignConcepts, campaignCreators, creatorContacts, creators, creatorSnapshots, videos

### Community 29 - "Community 29"
Cohesion: 0.22
Nodes (12): BatchUpdateData, batchUpdateResiByClient(), getPortalData(), loginPortal(), logoutPortal(), submitClientApproval(), updateClientNotes(), updateResiByClient() (+4 more)

### Community 30 - "Community 30"
Cohesion: 0.15
Nodes (12): action, default_popup, default_title, background, service_worker, content_scripts, description, host_permissions (+4 more)

### Community 31 - "Community 31"
Cohesion: 0.23
Nodes (9): fetchDailyPerformancePageDataAction(), getDailyData(), CampaignDailyPerformanceClient(), createEmptyGroup(), extractTikTokUploadDate(), GroupData, toWIBDateStr(), TimelineTarget() (+1 more)

### Community 32 - "Community 32"
Cohesion: 0.27
Nodes (11): idx_ads_campaign, idx_ads_creator, idx_sales_campaign, idx_sales_content_uid, idx_sales_creator, public.ad_name_mapping, public.ads_performance, public.sales (+3 more)

### Community 33 - "Community 33"
Cohesion: 0.17
Nodes (12): devDependencies, drizzle-kit, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/file-saver, @types/node (+4 more)

### Community 34 - "Community 34"
Cohesion: 0.26
Nodes (11): { createClient }, getOrCreateBrand(), getOrCreateCampaign(), parseApproval(), parseGMV(), parsePrice(), processAll(), processSheet() (+3 more)

### Community 35 - "Community 35"
Cohesion: 0.48
Nodes (10): addWhitelistEmail(), approveUser(), assignCampaignsToUser(), changeUserRole(), deactivateUser(), getAdminUser(), rejectUser(), removeWhitelistEmail() (+2 more)

### Community 36 - "Community 36"
Cohesion: 0.24
Nodes (4): metadata, DataLoader(), GlobalLoadingOverlay(), LayoutWrapper()

### Community 37 - "Community 37"
Cohesion: 0.29
Nodes (7): file-saver, dynamic, SummaryPage(), ExcelExportButton(), Props, fetchReportData(), generateExcelBuffer()

### Community 38 - "Community 38"
Cohesion: 0.20
Nodes (7): allCreators, diffs, legacy, raw1, raw2, rawCreators, xlsx

### Community 39 - "Community 39"
Cohesion: 0.20
Nodes (7): allCreators, diffs, legacy, raw1, raw2, rawCreators, xlsx

### Community 40 - "Community 40"
Cohesion: 0.22
Nodes (7): campaign_awareness_summary, campaign_total_awareness, get_campaign_performance(), ads_performance_delta, ads_performance, idx_ads_campaign, idx_ads_creator

### Community 41 - "Community 41"
Cohesion: 0.39
Nodes (7): getStatValue(), injectButton(), updatePreview(), isKalodata, observer, scrapeData(), scrapeKalodata()

### Community 42 - "Community 42"
Cohesion: 0.25
Nodes (8): public.daily_performance, public.vw_campaign_summary, public.campaign_creators, public.campaigns, public.sales, public.videos, public.ads_performance, public.creator_payments

### Community 43 - "Community 43"
Cohesion: 0.28
Nodes (8): dataPath, fileBudgeting, fileListing, fileTracking, findHeaderRow(), normalizeStr(), runRelationsMigration(), supabase

### Community 44 - "Community 44"
Cohesion: 0.31
Nodes (8): { createClient }, parseAudienceAge(), parseGMV(), parsePrice(), run(), sheetMapping, supabase, XLSX

### Community 46 - "Community 46"
Cohesion: 0.29
Nodes (6): next-auth, GET(), POST(), handlers, signIn, signOut

### Community 47 - "Community 47"
Cohesion: 0.39
Nodes (7): dataPath, fileListing, findHeaderRow(), normalizeLink(), normalizePhone(), normalizeUsername(), runAudit()

### Community 48 - "Community 48"
Cohesion: 0.29
Nodes (7): dataPath, fileBudgeting, fileListing, fileTracking, findDifferences(), normalizeStr(), supabase

### Community 49 - "Community 49"
Cohesion: 0.32
Nodes (7): dataPath, fileListing, fileTracking, findHeaderRow(), fixCampaigns(), normalizeStr(), supabase

### Community 50 - "Community 50"
Cohesion: 0.29
Nodes (7): dataPath, fileListing, fixIswhite(), normalizeStr(), require, supabase, XLSX

### Community 51 - "Community 51"
Cohesion: 0.32
Nodes (7): dataPath, fileListing, fileTracking, findHeaderRow(), normalizeStr(), runMigration(), supabase

### Community 52 - "Community 52"
Cohesion: 0.29
Nodes (7): { createClient }, dotenv, fs, mapCampaign(), run(), supabase, XLSX

### Community 53 - "Community 53"
Cohesion: 0.29
Nodes (7): dataPath, fileBudgeting, fileListing, fileTracking, normalizeStr(), supabase, validate()

### Community 54 - "Community 54"
Cohesion: 0.61
Nodes (6): addAdsAllocationAction(), addAdsTopupAction(), deleteAdsAllocationAction(), deleteAdsTopupAction(), fetchAdsBudgetingDataAction(), BudgetingAdsPage()

### Community 55 - "Community 55"
Cohesion: 0.29
Nodes (6): data, newKeySet, oldKeySet, OMG_MAKEUP_SKUS, workbook, XLSX

### Community 56 - "Community 56"
Cohesion: 0.29
Nodes (6): approvals, data, parsedData, rows, workbook, xlsx

### Community 57 - "Community 57"
Cohesion: 0.38
Nodes (6): dataPath, fileListing, findHeaderRow(), fixCampaignsFast(), normalizeStr(), supabase

### Community 58 - "Community 58"
Cohesion: 0.29
Nodes (6): approved, data, parsedData, rows, workbook, xlsx

### Community 59 - "Community 59"
Cohesion: 0.33
Nodes (6): { createClient }, parseApproval(), run(), sheetMapping, supabase, XLSX

### Community 60 - "Community 60"
Cohesion: 0.29
Nodes (6): bdContent, bdFile, ccContent, ccFile, fs, path

### Community 61 - "Community 61"
Cohesion: 0.33
Nodes (3): ColumnMapping, EnrichedAdsRow, ParsedAdsRow

### Community 62 - "Community 62"
Cohesion: 0.33
Nodes (4): dom, fs, html, { JSDOM }

### Community 63 - "Community 63"
Cohesion: 0.33
Nodes (5): basePath, files, fs, path, XLSX

### Community 64 - "Community 64"
Cohesion: 0.40
Nodes (5): dataPath, fileListing, findSpecificDiffs(), normalizeStr(), supabase

### Community 65 - "Community 65"
Cohesion: 0.40
Nodes (5): dataPath, fileBudgeting, normalizeStr(), runFinanceMigration(), supabase

### Community 66 - "Community 66"
Cohesion: 0.33
Nodes (5): data, parsedData, rows, workbook, xlsx

### Community 67 - "Community 67"
Cohesion: 0.33
Nodes (5): fs, grouped, rows, workbook, XLSX

### Community 68 - "Community 68"
Cohesion: 0.53
Nodes (5): approveInvoiceAction(), fetchInvoiceDataAction(), fetchInvoiceRincianAction(), rejectInvoiceAction(), InvoicePage()

### Community 70 - "Community 70"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, start

### Community 71 - "Community 71"
Cohesion: 0.40
Nodes (4): content1, file1, fs, path

### Community 72 - "Community 72"
Cohesion: 0.40
Nodes (4): data, uniqueVideos, workbook, xlsx

### Community 73 - "Community 73"
Cohesion: 0.40
Nodes (3): { createClient }, fs, supabase

### Community 74 - "Community 74"
Cohesion: 0.40
Nodes (3): fs, path, XLSX

### Community 75 - "Community 75"
Cohesion: 0.40
Nodes (4): brands, data, workbook, xlsx

### Community 76 - "Community 76"
Cohesion: 0.50
Nodes (4): checkCount(), { createClient }, run(), supabase

### Community 77 - "Community 77"
Cohesion: 0.40
Nodes (4): data, wardahRows, workbook, xlsx

### Community 78 - "Community 78"
Cohesion: 0.50
Nodes (4): checkColumns(), { createClient }, run(), supabase

### Community 79 - "Community 79"
Cohesion: 0.40
Nodes (3): fs, path, XLSX

### Community 80 - "Community 80"
Cohesion: 0.50
Nodes (4): dataPath, fileListing, findDupesInSheet(), normalizeStr()

### Community 81 - "Community 81"
Cohesion: 0.40
Nodes (3): { createClient }, supabase, xlsx

### Community 82 - "Community 82"
Cohesion: 0.40
Nodes (3): { createClient }, supabase, xlsx

### Community 83 - "Community 83"
Cohesion: 0.50
Nodes (4): fileListing, fixContactsAndSnapshots(), normalizeStr(), supabase

### Community 84 - "Community 84"
Cohesion: 0.50
Nodes (4): { createClient }, parseTikTokDate(), run(), supabase

### Community 85 - "Community 85"
Cohesion: 0.40
Nodes (3): { createClient }, supabase, xlsx

### Community 86 - "Community 86"
Cohesion: 0.50
Nodes (4): fileListing, fixVideos(), normalizeStr(), supabase

### Community 87 - "Community 87"
Cohesion: 0.50
Nodes (4): fileBudgeting, normalizeStr(), runFinanceMigrationFast(), supabase

### Community 88 - "Community 88"
Cohesion: 0.40
Nodes (3): { createClient }, supabase, xlsx

### Community 89 - "Community 89"
Cohesion: 0.40
Nodes (4): content, file, fs, path

### Community 90 - "Community 90"
Cohesion: 0.50
Nodes (4): { createClient }, levenshteinDistance(), run(), supabase

### Community 91 - "Community 91"
Cohesion: 0.40
Nodes (3): { createClient }, supabase, xlsx

### Community 92 - "Community 92"
Cohesion: 0.40
Nodes (3): { createClient }, supabase, xlsx

### Community 93 - "Community 93"
Cohesion: 0.40
Nodes (3): { createClient }, fs, path

### Community 94 - "Community 94"
Cohesion: 0.40
Nodes (3): anonKey, envFile, supabase

### Community 95 - "Community 95"
Cohesion: 0.40
Nodes (3): anonKey, envFile, supabase

### Community 96 - "Community 96"
Cohesion: 0.40
Nodes (3): anonKey, envFile, supabase

### Community 97 - "Community 97"
Cohesion: 0.40
Nodes (3): anonKey, envFile, supabase

### Community 98 - "Community 98"
Cohesion: 0.40
Nodes (3): anonKey, envFile, supabase

### Community 99 - "Community 99"
Cohesion: 0.40
Nodes (3): { createClient }, dotenv, supabase

### Community 100 - "Community 100"
Cohesion: 0.40
Nodes (3): { createClient }, dotenv, supabase

### Community 101 - "Community 101"
Cohesion: 0.40
Nodes (3): anonKey, envFile, supabase

### Community 102 - "Community 102"
Cohesion: 0.40
Nodes (3): anonKey, envFile, supabase

### Community 103 - "Community 103"
Cohesion: 0.60
Nodes (4): findHeaderRow(), normalizeStr(), run(), xlsx

### Community 104 - "Community 104"
Cohesion: 0.60
Nodes (4): log_cc_status_bayar_changes(), payout_creator, payout_requests, trg_cc_status_bayar

### Community 106 - "Community 106"
Cohesion: 0.83
Nodes (3): extractPartnerCenter(), parseCount(), saveData()

### Community 139 - "Community 139"
Cohesion: 0.50
Nodes (3): data, xlsx, workbook

### Community 142 - "Community 142"
Cohesion: 0.50
Nodes (3): sheets, workbook, XLSX

### Community 168 - "Community 168"
Cohesion: 0.50
Nodes (3): fs, path, tabs

### Community 177 - "Community 177"
Cohesion: 0.50
Nodes (3): data, workbook, xlsx

### Community 178 - "Community 178"
Cohesion: 0.50
Nodes (3): data, workbook, xlsx

### Community 186 - "Community 186"
Cohesion: 0.50
Nodes (3): data, workbook, xlsx

### Community 187 - "Community 187"
Cohesion: 0.50
Nodes (3): data, workbook, xlsx

### Community 188 - "Community 188"
Cohesion: 0.50
Nodes (3): fs, workbook, XLSX

### Community 189 - "Community 189"
Cohesion: 0.50
Nodes (3): data, workbook, XLSX

### Community 194 - "Community 194"
Cohesion: 0.67
Nodes (3): fs, roundImage(), sharp

### Community 260 - "Community 260"
Cohesion: 1.00
Nodes (3): getAuthProfileAction(), AuthProvider(), loadAuth()

## Knowledge Gaps
- **748 isolated node(s):** `isKalodata`, `manifest_version`, `name`, `version`, `description` (+743 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1112 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **203 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Community 8` to `Community 0`, `Community 1`, `Community 2`, `Community 4`, `Community 6`, `Community 7`, `Community 10`, `Community 11`, `Community 16`, `Community 17`, `Community 19`, `Community 29`, `Community 31`, `Community 35`, `Community 36`, `Community 37`, `Community 54`, `Community 226`, `Community 227`, `Community 229`, `Community 230`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Why does `dotenv` connect `Community 18` to `Community 256`, `Community 16`, `Community 43`, `Community 48`, `Community 49`, `Community 50`, `Community 51`, `Community 52`, `Community 53`, `Community 57`, `Community 64`, `Community 65`, `Community 196`, `Community 83`, `Community 86`, `Community 87`, `Community 99`, `Community 100`, `Community 241`, `Community 242`, `Community 243`, `Community 244`, `Community 245`, `Community 247`, `Community 253`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `profiles` connect `Community 5` to `Community 27`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **What connects `isKalodata`, `manifest_version`, `name` to the rest of the system?**
  _748 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06688963210702341 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.053297199638663056 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06698564593301436 - nodes in this community are weakly interconnected._