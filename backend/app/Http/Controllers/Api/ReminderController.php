<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SaveReminderRequest;
use App\Http\Resources\ReminderResource;
use App\Models\Reminder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

/**
 * Personal reminders: every user sees and manages only their own.
 */
class ReminderController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate(['status' => ['nullable', Rule::in(['pending', 'completed', 'all'])]]);
        $status = $request->input('status', 'pending');

        $reminders = $request->user()->reminders()
            ->when($status === 'pending', fn ($q) => $q->pending()->orderBy('due_at'))
            ->when($status === 'completed', fn ($q) => $q->whereNotNull('completed_at')->latest('completed_at'))
            ->when($status === 'all', fn ($q) => $q->orderByRaw('completed_at IS NOT NULL')->orderBy('due_at'))
            ->limit(200)
            ->get();

        return ReminderResource::collection($reminders);
    }

    public function store(SaveReminderRequest $request): JsonResponse
    {
        $reminder = $request->user()->reminders()->create($this->attributes($request));

        return ReminderResource::make($reminder)->response()->setStatusCode(201);
    }

    public function update(SaveReminderRequest $request, Reminder $reminder): ReminderResource
    {
        $reminder->update($this->attributes($request, $reminder));

        return ReminderResource::make($reminder);
    }

    public function destroy(Request $request, Reminder $reminder): JsonResponse
    {
        abort_unless($reminder->user_id === $request->user()->id, 403);

        $reminder->delete();

        return response()->json(['message' => 'Reminder deleted.']);
    }

    /**
     * @return array<string, mixed>
     */
    private function attributes(SaveReminderRequest $request, ?Reminder $reminder = null): array
    {
        $attributes = $request->safe()->only(['title', 'notes', 'due_at']);

        if ($request->has('completed')) {
            $attributes['completed_at'] = $request->boolean('completed')
                ? ($reminder?->completed_at ?? now())
                : null;
        }

        return $attributes;
    }
}
