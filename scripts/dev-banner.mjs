const target = process.argv[2] ?? "all";

const labels = {
  admin: "Admin application",
  all: "Full monorepo",
  api: "API",
  web: "Web application",
  workspace: "Workspace UI",
};

const selected = labels[target] ?? labels.all;

console.log(`
========================================

JPosta Development
Mode: ${selected}

Web:
http://localhost:3000

Admin:
http://localhost:3001

API:
http://localhost:4000

========================================
`);
