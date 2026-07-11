export type priority = 'low' | 'medium' | 'high';
export type status = 'todo' | 'in_progress' | 'done';

export interface Task {
    id: string;
    user_id: string;
    title: string;
    description: string;
    priority: priority;
    status: status;
    due_date: Date;
    created_at: Date;
    updated_at: Date;
    grade_max?: number | null;
    grade_earned?: number | null;
}

export interface Event {
    id: string;
    user_id: string;
    title: string;
    start_time: Date;
    end_time: Date;
    description: string;
    created_at: Date;
    updated_at: Date;
    source: string;
}

export interface Course {
    id: string;
    user_id: string;
    name: string;
    name_code: string;
    instructor: string;
    description: string;
    created_at: Date;
    updated_at: Date;
}