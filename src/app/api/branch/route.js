import { NextResponse } from 'next/server';


const branches = [];
let nextBranchId = 1;

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function GET(request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (id) {
    const branch = branches.find((item) => item.id === Number(id));

    if (!branch) {
      return jsonResponse({ error: 'Branch not found' }, 404);
    }

    return jsonResponse(branch);
  }

  return jsonResponse(branches);
}

export async function POST(request) {
  const body = await request.json();

  if (!body || !body.name) {
    return jsonResponse({ error: 'Branch name is required' }, 400);
  }

  const branch = {
    id: nextBranchId++,
    name: body.name,
    address: body.address || '',
    phone: body.phone || '',
  };

  branches.push(branch);

  return jsonResponse(branch, 201);
}

export async function PATCH(request) {
  const body = await request.json();
  const url = new URL(request.url);
  const id = body?.id || url.searchParams.get('id');

  if (!id) {
    return jsonResponse({ error: 'Branch id is required' }, 400);
  }

  const branch = branches.find((item) => item.id === Number(id));

  if (!branch) {
    return jsonResponse({ error: 'Branch not found' }, 404);
  }

  if (body.name !== undefined) branch.name = body.name;
  if (body.address !== undefined) branch.address = body.address;
  if (body.phone !== undefined) branch.phone = body.phone;

  return jsonResponse(branch);
}

export async function DELETE(request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  let body = null;
  try {
    body = await request.json();
  } catch (error) {
    body = null;
  }

  const branchId = id || body?.id;

  if (!branchId) {
    return jsonResponse({ error: 'Branch id is required' }, 400);
  }

  const index = branches.findIndex((item) => item.id === Number(branchId));

  if (index === -1) {
    return jsonResponse({ error: 'Branch not found' }, 404);
  }

  branches.splice(index, 1);

  return jsonResponse({ message: 'Branch deleted successfully' }, 200);
}
