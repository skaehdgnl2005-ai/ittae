import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/auth";
import { mapMemory } from "@/lib/mappers";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body: { note?: string; photos?: string[] } = await request.json();

  const supabase = await createServerClient();

  const updateData: { note?: string; photos?: string[] } = {};
  if (body.note !== undefined) updateData.note = body.note;
  if (body.photos !== undefined) updateData.photos = body.photos;

  const { data: memory, error } = await supabase
    .from("memories")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!memory) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: mapMemory(memory) });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const deleteAuth = await requireAuth();
  if (deleteAuth.error) return deleteAuth.error;

  const { id } = await params;
  const supabase = await createServerClient();

  const { error } = await supabase.from("memories").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
