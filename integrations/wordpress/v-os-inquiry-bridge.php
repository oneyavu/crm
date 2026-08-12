<?php

defined('ABSPATH') || exit;

function vos_stable_value($value) {
    if (!is_array($value)) {
        return $value;
    }
    if (array_keys($value) !== range(0, count($value) - 1)) {
        ksort($value, SORT_STRING);
    }
    foreach ($value as $key => $entry) {
        $value[$key] = vos_stable_value($entry);
    }
    return $value;
}

function vos_inquiry_payload($source) {
    $map = array(
        'submission_id' => 'externalId',
        'business_name' => 'organizationName',
        'business_website' => 'website',
        'market' => 'country',
        'industry' => 'industry',
        'company_size' => 'organizationSize',
        'contact_name' => 'contactName',
        'contact_email' => 'email',
        'contact_phone' => 'phone',
        'challenge' => 'challenge',
        'desired_outcome' => 'desiredOutcome',
        'current_systems' => 'currentSystems',
        'monthly_volume' => 'monthlyVolume',
        'timeline' => 'timeline',
        'budget_range' => 'investment',
        'delivery_model' => 'deliveryModel',
        'data_sensitivity' => 'sensitivity',
        'hosting_preference' => 'hosting',
        'meeting_preference' => 'followUp',
        'security_requirements' => 'security',
        'additional_notes' => 'notes',
    );
    $payload = array();
    foreach ($map as $from => $to) {
        if (isset($source[$from]) && $source[$from] !== '') {
            $payload[$to] = is_scalar($source[$from])
                ? sanitize_textarea_field((string) $source[$from])
                : $source[$from];
        }
    }
    $payload['consent'] = isset($source['consent']) && in_array(
        strtolower((string) $source['consent']),
        array('1', 'true', 'yes', 'on'),
        true
    );
    $payload['campaign'] = array_filter(array(
        'source' => isset($source['source']) ? sanitize_text_field((string) $source['source']) : '',
        'interest' => isset($source['interest']) ? sanitize_text_field((string) $source['interest']) : '',
        'context' => isset($source['context']) ? sanitize_text_field((string) $source['context']) : '',
        'profile' => isset($source['profile_key']) ? sanitize_text_field((string) $source['profile_key']) : '',
        'pageUrl' => isset($source['page_url']) ? esc_url_raw((string) $source['page_url']) : '',
        'referrer' => isset($source['referrer']) ? esc_url_raw((string) $source['referrer']) : '',
        'contactRole' => isset($source['contact_role']) ? sanitize_text_field((string) $source['contact_role']) : '',
        'decisionRole' => isset($source['decision_role']) ? sanitize_text_field((string) $source['decision_role']) : '',
        'locations' => isset($source['locations']) ? sanitize_text_field((string) $source['locations']) : '',
        'timezone' => isset($source['client_timezone']) ? sanitize_text_field((string) $source['client_timezone']) : '',
    ));
    return $payload;
}

function vos_send_inquiry($payload, $blocking) {
    $timestamp = (string) time();
    $body = wp_json_encode(vos_stable_value($payload), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $signature = 'sha256=' . hash_hmac('sha256', $timestamp . '.' . $body, VOS_INTAKE_SECRET);
    return wp_remote_post(VOS_INTAKE_ENDPOINT, array(
        'timeout' => 4,
        'blocking' => $blocking,
        'headers' => array(
            'Content-Type' => 'application/json',
            'X-VAYU-Timestamp' => $timestamp,
            'X-VAYU-Signature' => $signature,
        ),
        'body' => $body,
    ));
}

function vos_retry_inquiry($payload, $attempt) {
    $response = vos_send_inquiry($payload, true);
    $failed = is_wp_error($response) || wp_remote_retrieve_response_code($response) >= 300;
    if ($failed && $attempt < 5) {
        wp_schedule_single_event(time() + (60 * (2 ** $attempt)), 'vos_retry_inquiry', array($payload, $attempt + 1));
    }
}

function vos_forward_inquiry($response, $handler, $request) {
    if (!defined('VOS_INTAKE_ENDPOINT') || !defined('VOS_INTAKE_SECRET')) {
        return $response;
    }
    if ($request->get_method() !== 'POST' || $request->get_route() !== '/vayu/v1/inquiries') {
        return $response;
    }
    $status = method_exists($response, 'get_status') ? $response->get_status() : 500;
    if ($status >= 400) {
        return $response;
    }
    $payload = vos_inquiry_payload($request->get_json_params() ?: $request->get_params());
    $payload['externalId'] = isset($payload['externalId'])
        ? (string) $payload['externalId']
        : 'wordpress-' . hash('sha256', wp_json_encode($payload));
    vos_send_inquiry($payload, false);
    wp_schedule_single_event(time() + 60, 'vos_retry_inquiry', array($payload, 1));
    return $response;
}

add_filter('rest_request_after_callbacks', 'vos_forward_inquiry', 10, 3);
add_action('vos_retry_inquiry', 'vos_retry_inquiry', 10, 2);
