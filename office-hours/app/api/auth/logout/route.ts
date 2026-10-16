import { NextResponse } from 'next/server';
import { clearAdminSession } from '@/lib/auth';
import { baseUrl } from '@/lib/google/oauth';

export async function POST() { await clearAdminSession(); return NextResponse.redirect(`${baseUrl()}/office-hours/admin/login`, 303); }
