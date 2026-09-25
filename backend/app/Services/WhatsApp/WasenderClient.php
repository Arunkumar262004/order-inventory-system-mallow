<?php

namespace App\Services\WhatsApp;

use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;

/**
 * Thin wrapper around wasender.dev's "send text message" endpoint.
 *
 * @see https://wasender.dev
 */
class WasenderClient
{
    public function isConfigured(): bool
    {
        return filled(config('services.wasender.token'));
    }

    /**
     * A 2xx response means WhatsApp accepted the message for delivery.
     *
     * @param  string  $to  recipient in E.164 format, e.g. +919876543210
     * @return array<string, mixed> decoded API response
     *
     * @throws RequestException on a non-2xx response (lets the queue retry)
     */
    public function sendText(string $to, string $text): array
    {
        return Http::withToken(config('services.wasender.token'))
            ->acceptJson()
            ->timeout(config('services.wasender.timeout'))
            ->post(config('services.wasender.url'), [
                // The API wants international format without the leading "+".
                'to' => ltrim($to, '+'),
                'body' => $text,
            ])
            ->throw()
            ->json() ?? [];
    }
}
