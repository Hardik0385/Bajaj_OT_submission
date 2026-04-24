const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const myInfo = {
  full_name: "hardik_agrawal",
  dob: "04112004",
  email_id: "ha9137@srmist.edu.in",
  college_roll_number: "RA2111003010340"
};

function checkEntry(raw) {
  if (typeof raw !== "string") {
    return { valid: false, trimmed: String(raw) };
  }

  const val = raw.trim();

  if (val === "") return { valid: false, trimmed: val };

  const idx = val.indexOf("->");
  if (idx === -1) return { valid: false, trimmed: val };

  if (val.indexOf("->", idx + 2) !== -1) return { valid: false, trimmed: val };

  const sides = val.split("->");
  if (sides.length !== 2) return { valid: false, trimmed: val };

  const p = sides[0];
  const c = sides[1];

  if (p.length !== 1 || !/^[A-Z]$/.test(p)) return { valid: false, trimmed: val };
  if (c.length !== 1 || !/^[A-Z]$/.test(c)) return { valid: false, trimmed: val };
  if (p === c) return { valid: false, trimmed: val };

  return { valid: true, trimmed: val, parent: p, child: c };
}

function detectCycle(adjMap, nodeList) {
  const state = {};
  for (const n of nodeList) state[n] = 0;

  function visit(node) {
    state[node] = 1;
    for (const next of (adjMap[node] || [])) {
      if (state[next] === 1) return true;
      if (state[next] === 0 && visit(next)) return true;
    }
    state[node] = 2;
    return false;
  }

  for (const n of nodeList) {
    if (state[n] === 0 && visit(n)) return true;
  }
  return false;
}

function makeTree(adjMap, node, seen = new Set()) {
  if (seen.has(node)) return {};
  seen.add(node);
  const obj = {};
  const kids = (adjMap[node] || []).slice().sort();
  for (const k of kids) {
    obj[k] = makeTree(adjMap, k, seen);
  }
  return obj;
}

function treeDepth(adjMap, node, visited = new Set()) {
  if (visited.has(node)) return 0;
  visited.add(node);
  const kids = adjMap[node] || [];
  if (kids.length === 0) return 1;
  let best = 0;
  for (const k of kids) {
    const d = treeDepth(adjMap, k, visited);
    if (d > best) best = d;
  }
  return 1 + best;
}

function getGroups(nodeSet, edgeList) {
  const graph = {};
  for (const n of nodeSet) graph[n] = new Set();
  for (const [a, b] of edgeList) {
    graph[a].add(b);
    graph[b].add(a);
  }

  const done = new Set();
  const groups = [];

  for (const n of nodeSet) {
    if (done.has(n)) continue;
    const grp = new Set();
    const q = [n];
    done.add(n);
    while (q.length > 0) {
      const cur = q.shift();
      grp.add(cur);
      for (const nb of graph[cur]) {
        if (!done.has(nb)) {
          done.add(nb);
          q.push(nb);
        }
      }
    }
    groups.push(grp);
  }

  return groups;
}

function getRootOf(adjMap, members) {
  const asChild = new Set();
  for (const n of members) {
    for (const ch of (adjMap[n] || [])) asChild.add(ch);
  }
  const sorted = Array.from(members).sort();
  for (const n of sorted) {
    if (!asChild.has(n)) return n;
  }
  return sorted[0];
}

function runProcess(inputData) {
  const badEntries = [];
  const seenEdges = new Map();
  const repeatedEdges = [];
  const cleanEdges = [];

  for (const item of inputData) {
    const res = checkEntry(item);
    if (!res.valid) {
      badEntries.push(res.trimmed);
      continue;
    }

    const key = `${res.parent}->${res.child}`;
    if (seenEdges.has(key)) {
      if (seenEdges.get(key) === 1) repeatedEdges.push(key);
      seenEdges.set(key, seenEdges.get(key) + 1);
    } else {
      seenEdges.set(key, 1);
      cleanEdges.push([res.parent, res.child]);
    }
  }

  const parentOf = new Map();
  const usedEdges = [];
  const adjacency = {};
  const nodePool = new Set();

  for (const [par, ch] of cleanEdges) {
    if (parentOf.has(ch)) continue;
    parentOf.set(ch, par);
    usedEdges.push([par, ch]);
    nodePool.add(par);
    nodePool.add(ch);
    if (!adjacency[par]) adjacency[par] = [];
    adjacency[par].push(ch);
  }

  for (const n of nodePool) {
    if (!adjacency[n]) adjacency[n] = [];
  }

  const groups = getGroups(nodePool, usedEdges);
  const results = [];
  let treeCnt = 0;
  let cycleCnt = 0;
  let bigRoot = null;
  let bigDepth = 0;

  for (const grp of groups) {
    const members = Array.from(grp).sort();

    const localAdj = {};
    for (const n of members) {
      localAdj[n] = (adjacency[n] || []).filter(x => grp.has(x));
    }

    const hasCycle = detectCycle(localAdj, members);

    if (hasCycle) {
      cycleCnt++;
      const root = getRootOf(localAdj, members);
      results.push({ root, tree: {}, has_cycle: true });
    } else {
      treeCnt++;
      const root = getRootOf(localAdj, members);
      const subtree = makeTree(localAdj, root);
      const depth = treeDepth(localAdj, root);

      results.push({ root, tree: { [root]: subtree }, depth });

      if (depth > bigDepth || (depth === bigDepth && (bigRoot === null || root < bigRoot))) {
        bigDepth = depth;
        bigRoot = root;
      }
    }
  }

  results.sort((x, y) => {
    const xc = x.has_cycle ? 1 : 0;
    const yc = y.has_cycle ? 1 : 0;
    if (xc !== yc) return xc - yc;
    return x.root.localeCompare(y.root);
  });

  return {
    user_id: `${myInfo.full_name}_${myInfo.dob}`,
    email_id: myInfo.email_id,
    college_roll_number: myInfo.college_roll_number,
    hierarchies: results,
    invalid_entries: badEntries,
    duplicate_edges: repeatedEdges,
    summary: {
      total_trees: treeCnt,
      total_cycles: cycleCnt,
      largest_tree_root: bigRoot || ""
    }
  };
}

app.post("/bfhl", (req, res) => {
  try {
    const { data } = req.body;
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: "Expected { data: [...] } in request body" });
    }
    return res.json(runProcess(data));
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/bfhl", (req, res) => {
  res.json({ operation_code: 1 });
});

app.get("/", (req, res) => {
  res.send(`
    <div style="font-family: system-ui, sans-serif; padding: 40px; text-align: center;">
      <h1 style="color: #005eb8;">BFHL Backend API is Live 🚀</h1>
      <p>This URL handles the BFHL graph processing requests. It intentionally does not display the User Interface.</p>
      <p>Direct POST requests to <code>/bfhl</code>.</p>
    </div>
  `);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
