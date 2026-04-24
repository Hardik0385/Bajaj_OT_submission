const URL = "http://localhost:3000";

async function sendData(inputArray) {
  const req = await fetch(`${URL}/bfhl`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: inputArray }),
  });
  return req.json();
}

let ok = 0;
let bad = 0;

function check(cond, name, msg) {
  if (cond) {
    console.log(`  ✅ ${name}`);
    ok++;
  } else {
    console.log(`  ❌ ${name}`);
    if (msg) console.log(`     ${msg}`);
    bad++;
  }
}

function match(x, y) {
  return JSON.stringify(x) === JSON.stringify(y);
}

async function run() {
  console.log("\n--- Edge Case Tests ---");

  let res = await sendData(["hello"]);
  check(match(res.invalid_entries, ["hello"]), "hello = invalid");

  res = await sendData(["1->2"]);
  check(match(res.invalid_entries, ["1->2"]), "1->2 = invalid");

  res = await sendData(["AB->C"]);
  check(match(res.invalid_entries, ["AB->C"]), "AB->C = invalid");

  res = await sendData(["A->BC"]);
  check(match(res.invalid_entries, ["A->BC"]), "A->BC = invalid");

  res = await sendData(["A~>B"]);
  check(match(res.invalid_entries, ["A~>B"]), "A~>B = invalid");

  res = await sendData(["A-B"]);
  check(match(res.invalid_entries, ["A-B"]), "A-B = invalid");

  res = await sendData(["A=B"]);
  check(match(res.invalid_entries, ["A=B"]), "A=B = invalid");

  res = await sendData(["A->"]);
  check(match(res.invalid_entries, ["A->"]), "A-> = invalid");

  res = await sendData(["->B"]);
  check(match(res.invalid_entries, ["->B"]), "->B = invalid");

  res = await sendData(["->"]);
  check(match(res.invalid_entries, ["->"]), "-> = invalid");

  res = await sendData(["A->A"]);
  check(match(res.invalid_entries, ["A->A"]), "A->A = loop");

  res = await sendData(["Z->Z"]);
  check(match(res.invalid_entries, ["Z->Z"]), "Z->Z = loop");

  res = await sendData([""]);
  check(match(res.invalid_entries, [""]), "empty string = invalid");

  res = await sendData(["a->b"]);
  check(match(res.invalid_entries, ["a->b"]), "a->b = invalid");

  res = await sendData(["A->b"]);
  check(match(res.invalid_entries, ["A->b"]), "A->b = invalid");

  res = await sendData(["a->B"]);
  check(match(res.invalid_entries, ["a->B"]), "a->B = invalid");

  res = await sendData(["A->B->C"]);
  check(match(res.invalid_entries, ["A->B->C"]), "A->B->C = invalid");

  res = await sendData(["A-->B"]);
  check(match(res.invalid_entries, ["A-->B"]), "A-->B = invalid");

  res = await sendData([" A->B "]);
  check(res.invalid_entries.length === 0, "space A->B = valid");
  check(res.hierarchies.length === 1, "space creates 1 tree");
  check(res.hierarchies[0]?.root === "A", "root is A");

  res = await sendData(["  "]);
  check(res.invalid_entries.length === 1, "spaces = invalid");

  res = await sendData(["\t"]);
  check(res.invalid_entries.length === 1, "tab = invalid");

  res = await sendData(["  A->B  ", "A->B"]);
  check(res.duplicate_edges.length === 1, "padded and unpadded is duplicate");

  res = await sendData([42, "A->B"]);
  check(res.invalid_entries.includes("42"), "42 is invalid");
  check(res.hierarchies.length === 1, "still handles string");

  res = await sendData([null, "A->B"]);
  check(res.invalid_entries.includes("null"), "null = invalid");

  res = await sendData([true, false, "A->B"]);
  check(res.invalid_entries.includes("true"), "true = invalid");
  check(res.invalid_entries.includes("false"), "false = invalid");

  res = await sendData(["A->B", "A->B"]);
  check(match(res.duplicate_edges, ["A->B"]), "2 A->B gives dup A->B");

  res = await sendData(["A->B", "A->B", "A->B"]);
  check(match(res.duplicate_edges, ["A->B"]), "3 A->B gives 1 dup");

  res = await sendData(["A->B", "A->B", "C->D", "C->D"]);
  check(res.duplicate_edges.length === 2, "2 sets of dupes");
  check(res.duplicate_edges.includes("A->B"), "has A->B dupe");
  check(res.duplicate_edges.includes("C->D"), "has C->D dupe");

  res = await sendData(["A->B", "C->D"]);
  check(res.duplicate_edges.length === 0, "no dupes");

  res = await sendData(["A->D", "B->D"]);
  check(res.hierarchies.length === 1, "A->D and B->D means 1 tree, orphan discarded");
  check(res.hierarchies[0]?.root === "A", "Root is A");

  res = await sendData(["B->D", "A->D"]);
  check(res.hierarchies.length === 1, "B->D, A->D makes 1 tree");
  check(res.hierarchies[0]?.root === "B", "root is B");

  res = await sendData(["X->Y", "Y->X", "Z->X"]);
  check(!res.hierarchies.some(h => h.root === "Z"), "Z->X dumped due to Y->X pre-existence");

  res = await sendData(["A->B"]);
  check(res.hierarchies.length === 1, "1 edge 1 tree");
  check(res.hierarchies[0]?.root === "A", "root A");
  check(res.hierarchies[0]?.depth === 2, "depth 2");
  check(match(res.hierarchies[0]?.tree, { A: { B: {} } }), "correct tree");

  res = await sendData(["A->B", "A->C"]);
  check(res.hierarchies[0]?.depth === 2, "depth is 2");
  check(res.hierarchies[0]?.tree?.A?.B !== undefined, "has A->B");
  check(res.hierarchies[0]?.tree?.A?.C !== undefined, "has A->C");

  res = await sendData(["A->B", "B->C", "C->D", "D->E"]);
  check(res.hierarchies[0]?.depth === 5, "depth 5 chain");

  res = await sendData(["A->B", "C->D"]);
  check(res.hierarchies.length === 2, "2 unconnected trees");

  res = await sendData(["A->C", "A->B"]);
  const k = Object.keys(res.hierarchies[0]?.tree?.A || {});
  check(k[0] === "B" && k[1] === "C", "sorted alphabetically");

  res = await sendData(["A->B", "B->A"]);
  let cycEntry = res.hierarchies.find(h => h.has_cycle === true);
  check(cycEntry !== undefined, "cycle seen");
  check(match(cycEntry?.tree, {}), "cycle tree empty");
  check(cycEntry?.depth === undefined, "no depth on cycle");

  res = await sendData(["A->B", "B->C", "C->A"]);
  const c3 = res.hierarchies.find(h => h.has_cycle === true);
  check(c3 !== undefined, "3 node cycle ok");
  check(c3?.root === "A", "pure cycle uses small root A");

  res = await sendData(["A->B"]);
  check(res.hierarchies[0]?.has_cycle === undefined, "normal tree no cycle flag");

  res = await sendData(["A->B", "X->Y", "Y->X"]);
  check(res.summary.total_trees === 1, "1 tree count");
  check(res.summary.total_cycles === 1, "1 cycle count");

  res = await sendData(["A->B"]);
  check(res.hierarchies[0]?.depth === 2, "depth 2 A-B");

  res = await sendData(["A->B", "B->C"]);
  check(res.hierarchies[0]?.depth === 3, "depth 3 A-B-C");

  res = await sendData(["A->B", "A->C", "B->D", "B->E", "D->F"]);
  check(res.hierarchies[0]?.depth === 4, "longest path is depth 4");

  res = await sendData(["A->B", "C->D"]);
  check(res.summary.total_trees === 2, "2 correct total_trees");
  check(res.summary.total_cycles === 0, "0 correct total_cycles");

  res = await sendData(["A->B", "X->Y", "Y->X"]);
  check(res.summary.total_trees === 1, "only actual trees in total");

  res = await sendData(["C->D", "A->B"]);
  check(res.summary.largest_tree_root === "A", "A before C when depth same");

  res = await sendData(["A->B", "C->D", "D->E"]);
  check(res.summary.largest_tree_root === "C", "depth 3 C beats depth 2 A");

  res = await sendData(["hello", "1->2"]);
  check(res.summary.largest_tree_root === "", "empty root when no trees");
  check(res.summary.total_trees === 0, "0 trees ok");

  res = await sendData([]);
  check(res.hierarchies.length === 0, "empty input empty hier");
  check(res.invalid_entries.length === 0, "empty input no bad");
  check(res.summary.total_trees === 0, "empty tree cnt");

  res = await sendData(["hello", "1->2", "A->", ""]);
  check(res.hierarchies.length === 0, "no trees if all bad");
  check(res.invalid_entries.length === 4, "4 bad found");

  res = await sendData(["A->B"]);
  check(res.user_id === "hardik_agrawal_04112004", "correct ID");
  check(res.email_id === "ha9137@srmist.edu.in", "correct email");
  check(res.college_roll_number === "RA2111003010340", "correct roll");

  res = await sendData([
    "A->B", "A->C", "B->D", "C->E", "E->F",
    "X->Y", "Y->X", "Z->X",
    "P->Q", "Q->R",
    "G->H", "G->H", "G->I",
    "hello", "1->2", "A->"
  ]);

  check(res.invalid_entries.length === 3, "3 bad entries ok");
  check(res.invalid_entries.includes("hello"), "hello tagged");
  check(res.invalid_entries.includes("1->2"), "1->2 tagged");
  check(res.invalid_entries.includes("A->"), "A-> tagged");
  check(res.duplicate_edges.length === 1, "1 dupe G->H");
  check(res.duplicate_edges.includes("G->H"), "G->H properly in dupes");
  check(res.summary.total_trees === 3, "3 good trees in big run");
  check(res.summary.total_cycles === 1, "1 cycle in big run");
  check(res.summary.largest_tree_root === "A", "A is best root");

  const aT = res.hierarchies.find(h => h.root === "A");
  check(aT?.depth === 4, "a dpth 4");
  check(aT?.tree?.A?.B?.D !== undefined, "ABD check");
  check(aT?.tree?.A?.C?.E?.F !== undefined, "ACEF check");

  const cyc = res.hierarchies.find(h => h.has_cycle === true);
  check(cyc !== undefined, "cycle is there");
  check(match(cyc?.tree, {}), "cyc tree properly empty");
  check(!res.hierarchies.some(h => h.root === "Z"), "Z is not here as edge tossed");

  const hcReq = await fetch(`${URL}/bfhl`);
  const hcResp = await hcReq.json();
  check(hcResp.operation_code === 1, "GET block returns code 1");

  const badBody = await fetch(`${URL}/bfhl`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const bdData = await badBody.json();
  check(badBody.status === 400, "400 empty body");
  check(bdData.error !== undefined, "has error desc");

  const strBody = await fetch(`${URL}/bfhl`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: "lol this is wrong" }),
  });
  check(strBody.status === 400, "400 string body");

  res = await sendData(["C->A", "A->B", "B->C"]);
  const pc1 = res.hierarchies.find(h => h.has_cycle === true);
  check(pc1?.root === "A", "pure cycle smallest is A");

  res = await sendData(["Z->Y", "Y->X", "X->Z"]);
  const pc2 = res.hierarchies.find(h => h.has_cycle === true);
  check(pc2?.root === "X", "pure cycle smallest is X");

  console.log(`\nDone. OK: ${ok}, BAD: ${bad}\n`);
  if (bad > 0) process.exit(1);
}

run().catch((e) => {
  console.log("FAIL:", e);
  process.exit(1);
});
