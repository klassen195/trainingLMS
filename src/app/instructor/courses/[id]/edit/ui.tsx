"use client";

import { useState, useTransition } from "react";
import {
  addAssignment,
  addLesson,
  updateAssignment,
  updateCourse,
  updateLesson,
} from "@/app/actions";
import { courseCategories, categoryLabel } from "@/lib/labels";
import type { Assignment, Course, CourseCategory, CourseStatus, Lesson } from "@/lib/training-lms-types";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

export function EditCourseForm({
  course,
  lessons,
  assignments,
}: {
  course: Course;
  lessons: Lesson[];
  assignments: Assignment[];
}) {
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? "");
  const [category, setCategory] = useState<CourseCategory>(course.category);
  const [status, setStatus] = useState<CourseStatus>(course.status);
  const [pending, startTransition] = useTransition();

  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonContent, setNewLessonContent] = useState("");
  const [newAssignmentTitle, setNewAssignmentTitle] = useState("");
  const [newAssignmentDescription, setNewAssignmentDescription] = useState("");

  return (
    <div className="space-y-10">
      <form
        className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(() => updateCourse({ id: course.id, title, description, category, status }));
        }}
      >
        <h2 className="text-lg font-semibold">Course details</h2>
        <div className="space-y-2">
          <FieldLabel htmlFor="edit-title">Title</FieldLabel>
          <Input id="edit-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="edit-description">Description</FieldLabel>
          <textarea
            id="edit-description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel htmlFor="edit-category">Category</FieldLabel>
            <select
              id="edit-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as CourseCategory)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              {courseCategories.map((cat) => (
                <option key={cat} value={cat}>{categoryLabel(cat)}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="edit-status">Status</FieldLabel>
            <select
              id="edit-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as CourseStatus)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
        <Button type="submit" variant="primary" disabled={pending} className="bg-[#0B2E4B] text-white">
          {pending ? "Saving..." : "Save course"}
        </Button>
      </form>

      <section className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Lessons</h2>
        <ul className="space-y-4">
          {lessons.map((lesson) => (
            <LessonEditor key={lesson.id} courseId={course.id} lesson={lesson} />
          ))}
        </ul>
        <form
          className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              await addLesson({
                courseId: course.id,
                title: newLessonTitle,
                content: newLessonContent,
                sortOrder: lessons.length + 1,
              });
              setNewLessonTitle("");
              setNewLessonContent("");
            });
          }}
        >
          <h3 className="text-sm font-medium">Add lesson</h3>
          <Input placeholder="Lesson title" required value={newLessonTitle} onChange={(e) => setNewLessonTitle(e.target.value)} />
          <textarea
            placeholder="Lesson content"
            required
            rows={3}
            value={newLessonContent}
            onChange={(e) => setNewLessonContent(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          />
          <Button type="submit" disabled={pending}>Add lesson</Button>
        </form>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Assignments</h2>
        <ul className="space-y-4">
          {assignments.map((assignment) => (
            <AssignmentEditor key={assignment.id} courseId={course.id} assignment={assignment} />
          ))}
        </ul>
        <form
          className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              await addAssignment({
                courseId: course.id,
                title: newAssignmentTitle,
                description: newAssignmentDescription,
                sortOrder: assignments.length + 1,
              });
              setNewAssignmentTitle("");
              setNewAssignmentDescription("");
            });
          }}
        >
          <h3 className="text-sm font-medium">Add assignment</h3>
          <Input placeholder="Assignment title" required value={newAssignmentTitle} onChange={(e) => setNewAssignmentTitle(e.target.value)} />
          <textarea
            placeholder="Assignment description"
            required
            rows={3}
            value={newAssignmentDescription}
            onChange={(e) => setNewAssignmentDescription(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          />
          <Button type="submit" disabled={pending}>Add assignment</Button>
        </form>
      </section>
    </div>
  );
}

function LessonEditor({ courseId, lesson }: { courseId: string; lesson: Lesson }) {
  const [title, setTitle] = useState(lesson.title);
  const [content, setContent] = useState(lesson.content);
  const [sortOrder, setSortOrder] = useState(String(lesson.sort_order));
  const [pending, startTransition] = useTransition();

  return (
    <li className="space-y-2 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea
        rows={3}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
      />
      <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(() =>
            updateLesson({
              courseId,
              lessonId: lesson.id,
              title,
              content,
              sortOrder: Number(sortOrder) || 0,
            })
          )
        }
      >
        Save lesson
      </Button>
    </li>
  );
}

function AssignmentEditor({ courseId, assignment }: { courseId: string; assignment: Assignment }) {
  const [title, setTitle] = useState(assignment.title);
  const [description, setDescription] = useState(assignment.description);
  const [sortOrder, setSortOrder] = useState(String(assignment.sort_order));
  const [pending, startTransition] = useTransition();

  return (
    <li className="space-y-2 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea
        rows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
      />
      <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(() =>
            updateAssignment({
              courseId,
              assignmentId: assignment.id,
              title,
              description,
              sortOrder: Number(sortOrder) || 0,
            })
          )
        }
      >
        Save assignment
      </Button>
    </li>
  );
}
