/**
 * Bulk DOI Import Script
 *
 * Fetches study metadata from CrossRef + EuropePMC (no API keys needed)
 * and inserts into the database, skipping duplicates.
 *
 * Usage: npx tsx scripts/bulk-doi-import.ts
 */

import axios from "axios";
import { db, pool } from "../server/db";
import { studies, type InsertStudy } from "../shared/schema";
import { eq, sql } from "drizzle-orm";

// ============================================================
// DOI LIST - parsed from user input
// ============================================================
const RAW_DOIS = `
10.1002/mpo.2950100302
10.1016/0306-9877(88)90091-6
10.1016/0016-5085(92)90790-6
10.1038/383676a0
10.1080/10408419891294181
10.1007/0-306-46875-1_112
10.1271/nogeikagaku1924.74.994
10.3136/nskkk.47.390
10.2174/1568026023394343
10.1007/978-94-017-0728-2_6
10.1007/978-94-017-0728-2_5
10.1007/978-94-017-0726-8
10.3136/fstr.11.135
10.1016/j.mehy.2004.07.038
10.1093/qjmed/hcm045
10.1038/nm0607-673
10.4315/0362-028x-71.9.1934
10.1016/j.foodcont.2007.08.012
10.3724/SP.J.1008.2008.00233
10.3143/geriatrics.45.439
10.1016/j.febslet.2009.05.052
10.3164/jcbn.08-193R
10.3724/SP.J.1008.2009.01203
10.1016/j.mehy.2010.02.029
10.1016/j.healun.2010.07.009
10.1146/annurev.food.102308.124101
10.1038/ki.2009.432
10.1177/1473230010038006002
10.3109/10715762.2010.500328
10.1016/j.mehy.2009.07.017
21275114
10.1186/2045-9912-1-13
10.3389/fphar.2011.00019
10.1016/S1000-1948(11)60031-2
10.1016/j.mehy.2010.09.026
10.2174/156802611794863517
10.1155/2011/809696
10.1159/000321946
10.2174/138161211797052600
10.2174/138161211797052664
10.1186/2045-9912-1-10
10.2495/WS110291
10.4061/2011/307875
10.12659/msm.881698
10.5897/SRE11.357
10.4081/ams.2011.e11
10.1016/j.mehy.2010.08.046
10.1111/j.1440-1681.2011.05479.x
10.12659/MSM.882886
10.1186/2045-9912-2-11
10.1155/2012/324256
10.1155/2012/353152
10.2174/138945013804806433
10.1097/SHK.0b013e318268deb2
10.1111/j.1440-1681.2011.05654.x
10.1097/CCM.0b013e318241112a
10.1038/nrgastro.2012.85
10.3724/SP.J.1260.2012.20082
10.4314/ajtcam.v10i1.22
10.1186/2045-9912-2-17
10.5897/AJPP11.515
23047522
10.1186/2045-9912-2-19
10.3867/j.issn.1000-3002.2012.05.013
10.38212/2224-6614.2099
10.1016/j.resp.2012.03.016
10.5772/34908
10.1016/j.bbagen.2011.05.006
10.1016/j.tifs.2011.10.009
10.1111/j.1432-2277.2012.01574.x
10.5754/hge11883
10.3109/10715762.2012.689429
10.1186/2045-9912-2-8
10.1016/j.jss.2011.12.025
10.1016/j.bbrc.2012.09.073
10.1016/j.freeradbiomed.2013.05.032
10.1111/cns.12094
10.4172/2167-1222.1000e116
24522022
10.4314/ajtcam.v10i5.23
10.3390/w5042094
10.2174/13816128113199990507
10.3390/ijms14102070
10.1186/2045-9912-3-11
10.1186/2045-9912-3-10
10.7150/ijbs.7220
10.1111/jcmm.12081
10.1016/j.pneurobio.2014.01.001
10.1007/s40263-013-0138-y
10.1186/2045-9912-4-10
10.1186/s12883-014-0176-1
10.1186/2045-9912-4-17
10.3760/cma.j.issn.2095-0160.2014.11.019
10.1007/s00216-013-7606-6
26753412
10.3969/j.issn.1008-7125.2014.10.014
10.3969/j.issn.1672-8467.2014.05.024
10.4172/2329-6895.1000189
10.1016/j.pharmthera.2014.04.006
10.1186/s13618-014-0019-6
10.1016/j.mehy.2014.01.013
10.1155/2014/807635
10.1097/TP.0000000000000311
10.1161/CIRCULATIONAHA.114.013566
10.4172/2168-975X.1000154
10.2147/TCRM.S90770
10.16476/j.pibb.2015.0032
10.1016/j.jtcvs.2015.06.004
10.1055/s-0034-1395509
10.1007/978-94-017-9691-0_2
10.1186/s13618-015-0034-2
10.1016/j.mehy.2015.04.014
10.1007/978-94-017-9691-0_1
10.1007/978-94-017-9691-0_4
10.1007/978-94-017-9691-0_3
10.1007/978-94-017-9691-0_8
10.1186/s13618-015-0035-1
10.1016/j.mehy.2015.01.018
10.1016/bs.mie.2014.11.038
26571560
10.3109/07853890.2015.1034765
10.1016/j.phrs.2015.02.004
10.1007/978-94-017-9691-0_6
10.3967/bes2015.034
10.1016/j.redox.2015.01.002
10.1007/978-94-017-9691-0_5
10.1007/978-94-017-9691-0
10.1007/978-94-017-9691-0_7
10.4103/2045-9912.179346
27000012
10.1080/15438627.2016.1258646
10.12659/msm.899807
10.12659/msm.897107
10.2147/TCRM.S102518
10.1186/s41100-016-0036-0
10.1016/j.phrs.2015.12.002
10.1080/19490976.2016.1182288
10.12688/f1000research.9758.1
10.4103/2045-9912.179347
10.4103/2045-9912.179336
10.4103/2045-9912.196904
10.18926/AMO/54590
10.4236/ijcm.2016.710005
10.33549/physiolres.933414
10.1155/2016/5806057
10.4103/2045-9912.196906
10.6061/clinics/2016(09)10
10.3164/jcbn.16-87
10.4103/2045-9912.208516
10.2174/1570159x14666160607205417
10.1186/s13063-017-2246-3
10.4314/tjpr.v16i11.27
10.1253/circj.CJ-17-0520
10.3892/etm.2017.4353
10.1002/ams2.320
10.15226/jnhfs.2017.00194
10.1136/postgradmedj-2016-134411
10.1097/PRS.0000000000003900
10.1166/jnn.2017.14210
10.18632/oncotarget.21130
10.1039/C7BM00699C
10.18103/imr.v3i2.321
10.14283/jarcp.2017.2
10.7150/thno.18745
10.1021/jacs.7b07492
10.1186/s12883-017-0817-2
10.1016/j.mehy.2017.05.017
10.15226/sojmid/5/2/00170
10.1166/jnn.2017.14210
10.3389/fnins.2018.00392
10.4103/2045-9912.248270
10.3892/ol.2018.9023
10.13294/j.aps.2018.0060
10.1159/000489737
10.1007/s40279-018-0948-7
10.3760/cma.j.issn.0412-4081.2018.08.015
10.1155/2018/2406594
10.1002/1873-3468.13064
10.31146/1682-8658-ecg-151-3-83-92
10.1080/19490976.2018.1546522
10.4103/2045-9912.229602
10.1002/adma.201801964
10.5772/intechopen.79507
10.4103/2045-9912.222451
10.46701/APJBG.2018012018005
10.4103/2045-9912.239959
10.1080/10715762.2018.1439166
10.1016/j.tem.2018.02.006
10.1016/j.mehy.2018.09.001
10.1016/j.jns.2018.11.004
10.1155/2019/3917393
10.3390/ijms20174278
10.2217/fnl-2019-0002
10.1016/j.phrs.2019.104450
10.1139/cjpp-2019-0098
10.4103/2045-9912.260649
10.1021/acsnano.9b04954
10.34175/jno201903001
10.3389/fonc.2019.00696
10.1021/acsnano.9b05124
10.3390/molecules24112076
10.1183/13993003.00597-2020
10.1038/s41575-019-0193-z
10.3389/fncel.2019.00155
10.1139/cjpp-2019-0067
10.1080/10715762.2019.1582770
31008498
10.1016/j.tifs.2019.06.008
10.1002/cplu.201900457
10.1002/adhm.201900463
10.2174/1381612825666190506123038
10.1016/j.amjms.2019.10.011
10.18821/0016-9900-2019-98-4-359-365
10.1093/abbs/gmz121
10.1139/cjpp-2018-0604
10.7150/ijbs.30741
10.4103/2045-9912.273960
10.4103/2045-9912.266996
10.2174/1381612826666201207220051
10.1631/jzus.B2000386
10.1007/s12264-020-00597-1
10.2174/1381612826666201113095720
10.1038/s41390-020-0998-z
10.1016/j.neuroscience.2020.09.034
10.1038/s41430-020-0680-x
10.1097/ACO.0000000000000915
10.4103/2045-9912.296044
10.3390/ijms21031110
10.3390/ijms21207475
10.1093/nsr/nwaa034
10.1007/s10311-020-01062-1
10.1016/j.ajem.2020.06.066
10.21037/jtd-2020-062
10.37247/PAMB.1.2020.22
10.3923/pjbs.2020.103.112
10.1177/1753466620951051
10.2174/1381612826666201124112152
10.20455/ros.2020.829
10.1093/qjmed/hcaa301
10.1093/qjmed/hcaa302
10.4236/ojrm.2020.92007
10.3389/fcvm.2020.588206
10.1142/11910
10.3389/fphar.2020.543718
10.1016/j.lfs.2020.118641
10.1111/apt.15782
10.1155/2020/2328768
10.2174/1381612826666201113100245
10.3389/fphys.2020.01065
10.2174/1381612826666200922155242
10.2174/1381612826666201019103446
10.1002/ardp.202000378
10.3390/antiox9121281
10.1007/978-981-15-7157-2_7
10.1007/978-981-15-7157-2_4
10.2174/1381612826666201211112846
10.21474/IJAR01/11998
10.3389/fphar.2020.00877
10.1007/978-981-15-7157-2_5
10.1038/s41557-020-00582-1
10.2174/1381612826666201211114141
10.2174/1381612826666201113095938
10.3390/biomedicines8110526
10.4103/2045-9912.295226
10.4103/2045-9912.279983
10.3390/cleantechnol2040033
10.4103/2045-9912.296045
10.3390/molecules25184251
10.2174/1381612826666200925123510
10.2174/1381612826666200806101137
10.2174/1381612826666201221150857
10.2174/1381612826666200821114016
10.1155/2020/8384742
10.1016/j.lfs.2020.117570
10.1016/j.biopha.2020.110589
10.2174/1381612826666200909124936
10.2174/1381612826666200925124235
10.2174/1381612826666200917152316
10.1007/978-981-15-7157-2
10.1007/978-981-15-7157-2_8
10.1007/978-981-15-7157-2_6
10.1007/978-981-15-7157-2_3
10.1007/978-981-15-7157-2_2
10.1007/978-981-15-7157-2_1
10.3390/plants10112270
10.1007/s00425-021-03706-0
10.1161/STROKEAHA.120.033117
10.4103/2045-9912.314331
10.1097/MCC.0000000000000820
10.1089/neu.2021.0053
10.1155/2021/3539415
10.3390/ijms22168724
10.1039/d1tb01661j
10.3390/cancers13040893
10.1155/2021/5513868
10.1021/acs.chemrestox.0c00456
10.3389/fmed.2020.586229
10.3389/fmed.2021.671215
10.33590/emj/21-00027
10.1016/j.ijhydene.2021.03.025
10.1016/j.jff.2021.104360
10.1139/cjpp-2021-0031
10.1139/cjpp-2021-0151
10.3390/plants10020367
10.20455/ros.2021.m.803
10.3389/fcell.2021.683686
10.1007/s10620-021-07254-1
10.4103/2045-9912.318863
10.1016/j.jbiotec.2021.06.005
10.7861/clinmed.2020-0370
10.3390/ijms22052549
10.1016/j.tem.2021.01.002
10.1142/S2575900020300052
10.2174/1381612827052102111445151
10.3389/fphys.2021.789507
10.3390/ijms22137211
10.3390/ijms22094566
10.2174/1381612827666210119103545
10.1155/2021/8844346
10.1002/wnan.1744
10.1016/j.jtcvs.2021.05.001
10.1177/15353702211007084
10.3390/microorganisms9010136
10.1155/2021/6659310
10.3390/pr9111876
10.1155/2022/2249749
10.3390/plants11152047
10.1007/s40204-022-00182-x
10.3390/ijms23052454
10.3389/fcvm.2022.802783
10.3389/fneur.2022.841310
10.3390/ijms23126591
10.1016/j.jpedsurg.2022.06.007
10.1631/jzus.B2100420
10.1186/s10020-022-00455-y
10.1016/j.intimp.2022.109124
10.3389/fpsyt.2022.947973
10.3389/fcimb.2022.924832
10.1159/000525175
10.1155/2022/9846572
10.1155/2022/9831406
10.1016/j.abb.2022.109256
10.1159/000520981
10.3760/cma.j.cn112151-20220113-00030
10.1016/j.jacbts.2021.12.008
10.3389/fmed.2022.817351
10.3390/antiox11101999
10.1016/j.jpedsurg.2022.09.041
10.1038/s41584-022-00870-9
10.3390/ijms232314508
10.3390/ijms232314750
10.21037/atm-22-4422
10.3390/molecules27041222
10.3389/frfst.2022.1007001
10.3390/pr10010087
10.4103/2045-9912.356472
10.4103/2045-9912.344982
10.4103/2045-9912.344972
10.4103/0973-1482.367454
10.1007/s12035-022-03175-w
10.4103/2045-9912.359677
10.4103/2045-9912.344978
10.4103/2045-9912.344977
10.4103/2045-9912.344980
10.1111/jocd.15757
10.3390/antiox12030636
10.21037/jtd-2022-22
10.31557/APJCP.2023.24.1.37
10.3389/fnut.2023.1094767
10.3390/antiox12050988
10.2147/JIR.S413179
10.3390/ph16040541
10.1007/s00018-023-04818-4
10.3390/ph16020142
10.1002/advs.202104136
10.3390/biomedicines11071892
10.3390/brainsci13081168
10.1515/biol-2022-0658
10.1016/j.bbrc.2023.08.012
10.3390/ph16101394
10.3390/biomedicines11102817
10.1002/jbm.b.35326
10.1021/acs.chemrestox.3c00259
10.3390/ph16111567
10.1016/j.biopha.2023.115807
10.1089/ars.2023.0410
10.4103/2045-9912.378880
10.3390/antiox12122062
10.3390/molecules28237785
10.3389/fcell.2023.1283820
10.1021/acsami.3c16668
10.3390/ijms25020973
10.3390/biomedicines12010118
10.3390/antiox13010090
10.1007/s00417-023-06340-6
10.1002/smtd.202301349
10.2147/JIR.S445152
10.1093/nsr/nwae046
`;

// Also include PMIDs (bare numbers) - we'll look these up separately
const RAW_PMIDS = `
21275114
23047522
24522022
26753412
26571560
27000012
31008498
`;

// ResearchGate URLs (can't import via DOI, skip these)
const RESEARCHGATE_URLS = [
  "https://www.researchgate.net/publication/265171830_Application_of_Hydrogen_Producing_Microorganisms_in_Radiotherapy_An_Idea",
  "https://www.researchgate.net/publication/284899025_Hydrogen_use_in_urological_disease_models",
  "https://www.researchgate.net/publication/327202034_Molecular_Hydrogen_A_New_Approach_for_the_Management_of_Cardiovascular_Diseases",
  "https://www.researchgate.net/publication/335339520_Effect_of_drinking_hydrogen_rich_water_produced_by_Alkaline_Stick_for_Skin_care",
];

// Parse DOIs
function parseDOIs(raw: string): string[] {
  return raw
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0 && line.includes("/")) // DOIs contain /
    .filter(line => !line.startsWith("http")); // filter out URLs
}

function parsePMIDs(raw: string): string[] {
  return raw
    .split("\n")
    .map(line => line.trim())
    .filter(line => /^\d+$/.test(line));
}

// ============================================================
// API Functions
// ============================================================

async function fetchFromCrossRef(doi: string): Promise<any> {
  try {
    const response = await axios.get(
      `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
      {
        headers: {
          "User-Agent": "HydrogenStudies.com/1.0 (mailto:info@hydrogenstudies.com)",
        },
        timeout: 15000,
      }
    );
    return response.data;
  } catch {
    return null;
  }
}

async function fetchFromEuropePMC(doi: string): Promise<any> {
  try {
    const response = await axios.get(
      "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
      {
        params: {
          query: `DOI:${doi}`,
          resultType: "core",
          format: "json",
        },
        timeout: 15000,
      }
    );
    if (response.data.hitCount > 0 && response.data.resultList?.result?.length > 0) {
      return response.data.resultList.result[0];
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchFromEuropePMCByPMID(pmid: string): Promise<any> {
  try {
    const response = await axios.get(
      "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
      {
        params: {
          query: `EXT_ID:${pmid} AND SRC:MED`,
          resultType: "core",
          format: "json",
        },
        timeout: 15000,
      }
    );
    if (response.data.hitCount > 0 && response.data.resultList?.result?.length > 0) {
      return response.data.resultList.result[0];
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================
// Data extraction
// ============================================================

function extractFromCrossRef(data: any): Partial<InsertStudy> | null {
  if (!data?.message) return null;
  const msg = data.message;

  // Title
  const title = msg.title?.[0] || "Untitled Study";

  // Authors
  let authors = "Unknown Authors";
  if (msg.author?.length > 0) {
    authors = msg.author
      .map((a: any) => `${a.given || ""} ${a.family || ""}`.trim())
      .join(", ");
  }

  // Journal
  const journal = msg["container-title"]?.[0] || "Scientific Journal";

  // Dates
  let publishYear: number | null = null;
  let journalPublishDate: string | null = null;
  const dateSource = msg["published-print"] || msg["published-online"] || msg.created;
  if (dateSource?.["date-parts"]?.[0]) {
    const parts = dateSource["date-parts"][0];
    publishYear = parts[0];
    const month = parts.length > 1 ? String(parts[1]).padStart(2, "0") : "01";
    const day = parts.length > 2 ? String(parts[2]).padStart(2, "0") : "01";
    journalPublishDate = `${parts[0]}-${month}-${day}`;
  }

  // Abstract
  const abstract = msg.abstract?.replace(/<[^>]*>/g, "") || "";

  // Peer reviewed
  const peerReviewed = ["journal-article", "proceedings-article"].includes(msg.type);

  return {
    title,
    authors,
    journal,
    abstract,
    doi: msg.DOI || "",
    publishDate: new Date().toISOString().split("T")[0],
    journalPublishDate,
    publishYear,
    peerReviewed,
    category: "general",
    citationUrl: msg.DOI ? `https://doi.org/${msg.DOI}` : null,
    pdfUrl: msg.link?.[0]?.URL || null,
    sourcePlatform: "CrossRef",
  };
}

function extractFromEuropePMC(data: any): Partial<InsertStudy> | null {
  if (!data) return null;

  const pubYear = data.pubYear || (data.firstPublicationDate?.substring(0, 4));
  let journalPublishDate = data.firstPublicationDate || null;

  return {
    title: data.title || "Untitled Study",
    authors: data.authorString || "Unknown Authors",
    journal: data.journalInfo?.journal?.title || data.journalTitle || "Scientific Journal",
    abstract: data.abstractText || "",
    doi: data.doi || "",
    publishDate: new Date().toISOString().split("T")[0],
    journalPublishDate,
    publishYear: pubYear ? parseInt(pubYear) : null,
    peerReviewed: true,
    hasFullText: !!data.fullTextUrlList,
    category: "general",
    sourcePlatform: "EuropePMC",
  };
}

// Merge data from both sources, preferring the richer one
function mergeStudyData(crossref: Partial<InsertStudy> | null, europepmc: Partial<InsertStudy> | null): InsertStudy | null {
  if (!crossref && !europepmc) return null;

  const base = crossref || europepmc!;
  const supplement = crossref ? europepmc : null;

  // Start with the base and fill gaps from supplement
  const merged: any = { ...base };

  if (supplement) {
    // Prefer longer abstract
    if (supplement.abstract && (!merged.abstract || supplement.abstract.length > merged.abstract.length)) {
      merged.abstract = supplement.abstract;
    }
    // Fill missing fields from supplement
    if (!merged.journal || merged.journal === "Scientific Journal") merged.journal = supplement.journal || merged.journal;
    if (!merged.authors || merged.authors === "Unknown Authors") merged.authors = supplement.authors || merged.authors;
    if (!merged.publishYear) merged.publishYear = supplement.publishYear;
    if (!merged.journalPublishDate) merged.journalPublishDate = supplement.journalPublishDate;
    if (!merged.hasFullText) merged.hasFullText = supplement.hasFullText;
  }

  // Ensure required fields
  if (!merged.title || !merged.authors || !merged.journal || !merged.publishDate || !merged.category) {
    return null;
  }

  // Provide abstract fallback
  if (!merged.abstract) {
    merged.abstract = "Abstract not available.";
  }

  return merged as InsertStudy;
}

// Generate slug from title
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 120);
}

// ============================================================
// Main import logic
// ============================================================

async function checkDuplicateByDOI(doi: string): Promise<boolean> {
  if (!doi) return false;
  // Case-insensitive to match the intended lower(doi) index and avoid
  // re-inserting DOIs that differ only in letter case.
  const existing = await db
    .select({ id: studies.id })
    .from(studies)
    .where(sql`lower(${studies.doi}) = lower(${doi})`)
    .limit(1);
  return existing.length > 0;
}

async function checkDuplicateByPMID(pmid: string): Promise<boolean> {
  if (!pmid) return false;
  const existing = await db.select({ id: studies.id }).from(studies).where(eq(studies.pmid, pmid)).limit(1);
  return existing.length > 0;
}

async function importByDOI(doi: string, index: number, total: number): Promise<{ success: boolean; title?: string; error?: string }> {
  const label = `[${index + 1}/${total}]`;

  // Check duplicate
  if (await checkDuplicateByDOI(doi)) {
    console.log(`${label} SKIP (duplicate): ${doi}`);
    return { success: false, error: "duplicate" };
  }

  // Fetch from both sources in parallel
  const [crossrefData, europepmcData] = await Promise.all([
    fetchFromCrossRef(doi),
    fetchFromEuropePMC(doi),
  ]);

  const crossrefStudy = extractFromCrossRef(crossrefData);
  const europepmcStudy = extractFromEuropePMC(europepmcData);
  const study = mergeStudyData(crossrefStudy, europepmcStudy);

  if (!study) {
    console.log(`${label} FAIL (no data): ${doi}`);
    return { success: false, error: "no data found" };
  }

  // Set DOI and slug
  study.doi = doi;
  study.slug = slugify(study.title);
  study.citationUrl = `https://doi.org/${doi}`;

  try {
    await db.insert(studies).values({ ...study, createdAt: new Date() });
    console.log(`${label} OK: "${study.title.substring(0, 70)}..." (${study.publishYear || "?"})`);
    return { success: true, title: study.title };
  } catch (err: any) {
    console.log(`${label} FAIL (db): ${doi} - ${err.message?.substring(0, 80)}`);
    return { success: false, error: err.message };
  }
}

async function importByPMID(pmid: string, index: number, total: number): Promise<{ success: boolean; title?: string; error?: string }> {
  const label = `[PMID ${index + 1}/${total}]`;

  const europepmcData = await fetchFromEuropePMCByPMID(pmid);
  if (!europepmcData) {
    console.log(`${label} FAIL (no data): PMID ${pmid}`);
    return { success: false, error: "no data found" };
  }

  const doi = europepmcData.doi;
  if (doi && await checkDuplicateByDOI(doi)) {
    console.log(`${label} SKIP (duplicate): PMID ${pmid} (DOI: ${doi})`);
    return { success: false, error: "duplicate" };
  }

  // When EuropePMC returns no DOI, the DOI check above can't dedupe. Guard
  // against re-inserting the same PMID on every re-run by checking the stored
  // pmid column (populated on insert below).
  if (await checkDuplicateByPMID(pmid)) {
    console.log(`${label} SKIP (duplicate): PMID ${pmid}`);
    return { success: false, error: "duplicate" };
  }

  const study = extractFromEuropePMC(europepmcData);
  if (!study) {
    console.log(`${label} FAIL (extract): PMID ${pmid}`);
    return { success: false, error: "extraction failed" };
  }

  // Ensure required fields
  if (!study.abstract) study.abstract = "Abstract not available.";

  const slug = slugify(study.title || "untitled");

  try {
    await db.insert(studies).values({
      ...study,
      slug,
      pmid,
      citationUrl: doi ? `https://doi.org/${doi}` : `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      createdAt: new Date(),
    } as InsertStudy);
    console.log(`${label} OK: "${(study.title || "").substring(0, 70)}..." (PMID: ${pmid})`);
    return { success: true, title: study.title };
  } catch (err: any) {
    console.log(`${label} FAIL (db): PMID ${pmid} - ${err.message?.substring(0, 80)}`);
    return { success: false, error: err.message };
  }
}

async function main() {
  const dois = parseDOIs(RAW_DOIS);
  const pmids = parsePMIDs(RAW_PMIDS);

  console.log("=".repeat(60));
  console.log(`Hydrogen Studies - Bulk DOI Import`);
  console.log(`DOIs to import: ${dois.length}`);
  console.log(`PMIDs to import: ${pmids.length}`);
  console.log(`ResearchGate URLs (skipped): ${RESEARCHGATE_URLS.length}`);
  console.log("=".repeat(60));

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  // Process DOIs in batches of 5 to avoid rate limiting
  const BATCH_SIZE = 5;
  const DELAY_BETWEEN_BATCHES_MS = 1500;

  for (let i = 0; i < dois.length; i += BATCH_SIZE) {
    const batch = dois.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((doi, j) => importByDOI(doi, i + j, dois.length))
    );

    for (const r of results) {
      if (r.success) imported++;
      else if (r.error === "duplicate") skipped++;
      else failed++;
    }

    // Rate limit pause between batches
    if (i + BATCH_SIZE < dois.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
    }
  }

  // Process PMIDs
  for (let i = 0; i < pmids.length; i++) {
    const result = await importByPMID(pmids[i], i, pmids.length);
    if (result.success) imported++;
    else if (result.error === "duplicate") skipped++;
    else failed++;

    if (i < pmids.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("IMPORT COMPLETE");
  console.log(`  Imported: ${imported}`);
  console.log(`  Skipped (duplicates): ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total processed: ${imported + skipped + failed}`);
  console.log("=".repeat(60));

  if (RESEARCHGATE_URLS.length > 0) {
    console.log("\nResearchGate URLs (need manual import):");
    RESEARCHGATE_URLS.forEach(url => console.log(`  - ${url}`));
  }

  await pool.end();
}

main().catch(err => {
  console.error("Fatal error:", err);
  pool.end();
  process.exit(1);
});
