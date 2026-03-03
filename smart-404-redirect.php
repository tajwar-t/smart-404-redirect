<?php
/**
 * Plugin Name: Smart 404 Redirect
 * Plugin URI: https://example.com/smart-404-redirect
 * Description: Intelligently redirect 404 errors and specific pages with pattern matching and direct page redirects.
 * Version: 1.7.0
 * Author: Smart Plugins
 * License: GPL v2 or later
 * Text Domain: smart-404-redirect
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'S404R_VERSION', '1.7.0' );
define( 'S404R_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'S404R_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

class Smart404Redirect {

    private static $instance = null;
    private $option_name = 'smart_404_redirect_settings';
    private $page_hook   = '';          // Stores the hook suffix returned by add_menu_page()
    private $menu_slug   = 'smart-404-redirect';

    public static function get_instance() {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action( 'admin_menu',            array( $this, 'add_admin_menu' ) );
        add_action( 'admin_init',            array( $this, 'register_settings' ) );
        add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_scripts' ) );
        // Priority 1 = runs early, before most other plugins
        add_action( 'template_redirect',     array( $this, 'handle_page_redirects' ), 1 );
        add_action( 'template_redirect',     array( $this, 'handle_404' ), 2 );
        // AJAX handlers
        add_action( 'wp_ajax_s404r_save_rules',      array( $this, 'ajax_save_rules' ) );
        add_action( 'wp_ajax_s404r_save_redirects',  array( $this, 'ajax_save_redirects' ) );
        add_action( 'wp_ajax_s404r_save_general',    array( $this, 'ajax_save_general' ) );
        add_action( 'wp_ajax_s404r_clear_log',       array( $this, 'ajax_clear_log' ) );
        add_action('wp_ajax_s404r_export_log', array($this, 'ajax_export_log_csv'));
        register_activation_hook( __FILE__, array( $this, 'activate' ) );
    }

    // ─── ACTIVATION ─────────────────────────────────────────────────────────────

    public function activate() {
        if ( ! get_option( $this->option_name ) ) {
            add_option( $this->option_name, $this->defaults() );
        }
    }

    private function defaults() {
        return array(
            'default_redirect' => '',
            'redirect_type'    => '301',
            'rules'            => array(),
            'redirects'        => array(),
            'logging_enabled'  => false,
            'log'              => array(),
        );
    }

    public function get_settings() {
        $saved = get_option( $this->option_name, array() );
        return array_merge( $this->defaults(), is_array( $saved ) ? $saved : array() );
    }

    // ─── FRONT-END: PAGE REDIRECTS (fires on every request) ─────────────────────

    public function handle_page_redirects() {
        $settings  = $this->get_settings();
        $redirects = isset( $settings['redirects'] ) ? $settings['redirects'] : array();

        if ( empty( $redirects ) ) {
            return;
        }

        $current_path = '/' . ltrim( trim( parse_url( $_SERVER['REQUEST_URI'], PHP_URL_PATH ), '/' ), '/' );

        foreach ( $redirects as $redirect ) {
            if ( empty( $redirect['from'] ) || empty( $redirect['to'] ) ) {
                continue;
            }

            $from = '/' . ltrim( trim( $redirect['from'], '/' ), '/' );

            if ( strcasecmp( $current_path, $from ) === 0 ) {
                $to   = $redirect['to'];
                $code = isset( $redirect['type'] ) && in_array( $redirect['type'], array( '301', '302' ) )
                    ? intval( $redirect['type'] ) : 301;

                if ( ! empty( $settings['logging_enabled'] ) ) {
                    $this->log_redirect(
                        ltrim( $current_path, '/' ),
                        $to,
                        array( 'label' => isset( $redirect['label'] ) ? $redirect['label'] : 'Page Redirect' )
                    );
                }

                if ( strpos( $to, 'http' ) !== 0 ) {
                    $to = home_url( '/' . ltrim( $to, '/' ) );
                }

                wp_redirect( $to, $code );
                exit;
            }
        }
    }

    // ─── FRONT-END: 404 REDIRECTS ────────────────────────────────────────────────

    public function handle_404() {
        if ( ! is_404() ) {
            return;
        }

        $settings     = $this->get_settings();
        $current_url  = trim( parse_url( $_SERVER['REQUEST_URI'], PHP_URL_PATH ), '/' );
        $redirect_url = '';
        $matched_rule = null;

        if ( ! empty( $settings['rules'] ) ) {
            foreach ( $settings['rules'] as $rule ) {
                if ( empty( $rule['pattern'] ) || empty( $rule['redirect_to'] ) ) {
                    continue;
                }
                $pattern = trim( $rule['pattern'], '/' );
                $regex   = '#^' . str_replace( '\*', '.*', preg_quote( $pattern, '#' ) ) . '$#i';
                if ( preg_match( $regex, $current_url ) ) {
                    $redirect_url = $rule['redirect_to'];
                    $matched_rule = $rule;
                    break;
                }
            }
        }

        if ( empty( $redirect_url ) && ! empty( $settings['default_redirect'] ) ) {
            $redirect_url = $settings['default_redirect'];
        }

        if ( empty( $redirect_url ) ) {
            return;
        }

        if ( ! empty( $settings['logging_enabled'] ) ) {
            $this->log_redirect( $current_url, $redirect_url, $matched_rule );
        }

        if ( strpos( $redirect_url, 'http' ) !== 0 ) {
            $redirect_url = home_url( '/' . ltrim( $redirect_url, '/' ) );
        }

        $redirect_type = isset( $settings['redirect_type'] ) ? intval( $settings['redirect_type'] ) : 301;
        wp_redirect( $redirect_url, $redirect_type );
        exit;
    }

    // ─── LOGGING ─────────────────────────────────────────────────────────────────

    private function log_redirect( $from, $to, $rule = null ) {
        $settings = $this->get_settings();
        $log      = isset( $settings['log'] ) ? $settings['log'] : array();
        array_unshift( $log, array(
            'time' => current_time( 'mysql' ),
            'from' => $from,
            'to'   => $to,
            'rule' => $rule ? ( isset( $rule['label'] ) ? $rule['label'] : 'Rule' ) : 'Default',
        ) );
        $settings['log'] = array_slice( $log, 0, 500 );
        update_option( $this->option_name, $settings );
    }

    // ─── ADMIN ───────────────────────────────────────────────────────────────────

    public function add_admin_menu() {
        $this->page_hook = add_menu_page(
            'Smart 404 Redirect',           // Page title
            'URL Redirects',                 // Menu label
            'manage_options',               // Capability
            'smart-404-redirect',           // Menu slug
            array( $this, 'render_settings_page' ),
            'dashicons-randomize',          // Dashicon
            80                              // Position (below Settings)
        );
    }

    public function register_settings() {
        // No sanitize_callback — AJAX handlers sanitize their own input.
        // A sanitize_callback fires on every update_option() call and would overwrite data.
        register_setting( 'smart_404_redirect_group', $this->option_name );
    }

    public function render_settings_page() {
        echo '<div id="s404r-app"></div>';
    }

    public function enqueue_admin_scripts( $hook ) {
        // Hook name for a top-level menu page is the value returned by add_menu_page()
        if ( $hook !== $this->page_hook ) {
            return;
        }
        wp_enqueue_style(  's404r-admin', S404R_PLUGIN_URL . 'assets/admin.css', array(), '1.0.2' );
        wp_enqueue_script( 's404r-admin', S404R_PLUGIN_URL . 'assets/admin.js',  array( 'jquery' ), '1.0.0', true );
        wp_localize_script( 's404r-admin', 'S404R', array(
            'nonce'    => wp_create_nonce( 's404r_nonce' ),
            'ajax_url' => admin_url( 'admin-ajax.php' ),
            'settings' => $this->get_settings(),
            'pages'    => $this->get_pages_list(),
        ) );
    }

    public function get_pages_list_public() { return $this->get_pages_list(); }

    private function get_pages_list() {
        $pages  = get_pages( array( 'post_status' => 'publish' ) );
        $result = array();
        foreach ( $pages as $page ) {
            $result[] = array(
                'id'    => $page->ID,
                'title' => $page->post_title,
                'slug'  => '/' . get_page_uri( $page->ID ),
            );
        }
        return $result;
    }

    // ─── AJAX: GENERAL ───────────────────────────────────────────────────────────

    public function ajax_save_general() {
        check_ajax_referer( 's404r_nonce', 'nonce' );
        if ( ! current_user_can( 'manage_options' ) ) { wp_die( 'Unauthorized' ); }

        $settings = $this->get_settings();
        $settings['default_redirect'] = sanitize_text_field( $_POST['default_redirect'] ?? '' );
        $settings['redirect_type']    = in_array( $_POST['redirect_type'] ?? '', array( '301', '302' ) ) ? $_POST['redirect_type'] : '301';
        $settings['logging_enabled']  = ( ( $_POST['logging_enabled'] ?? '' ) === '1' );
        update_option( $this->option_name, $settings );
        wp_send_json_success( array( 'message' => 'General settings saved.' ) );
    }

    // ─── AJAX: 404 PATTERN RULES ─────────────────────────────────────────────────

    public function ajax_save_rules() {
        check_ajax_referer( 's404r_nonce', 'nonce' );
        if ( ! current_user_can( 'manage_options' ) ) { wp_die( 'Unauthorized' ); }

        $settings  = $this->get_settings();
        $rules     = array();
        $raw_rules = json_decode( stripslashes( $_POST['rules'] ?? '[]' ), true );

        if ( is_array( $raw_rules ) ) {
            foreach ( $raw_rules as $rule ) {
                $rules[] = array(
                    'id'          => sanitize_text_field( $rule['id'] ?? '' ),
                    'label'       => sanitize_text_field( $rule['label'] ?? '' ),
                    'pattern'     => sanitize_text_field( $rule['pattern'] ?? '' ),
                    'redirect_to' => sanitize_text_field( $rule['redirect_to'] ?? '' ),
                    'type'        => in_array( $rule['type'] ?? '', array( '301', '302' ) ) ? $rule['type'] : '301',
                );
            }
        }

        $settings['rules'] = $rules;
        update_option( $this->option_name, $settings );
        wp_send_json_success( array( 'message' => 'Rules saved.' ) );
    }

    // ─── AJAX: PAGE REDIRECTS ────────────────────────────────────────────────────

    public function ajax_save_redirects() {
        check_ajax_referer( 's404r_nonce', 'nonce' );
        if ( ! current_user_can( 'manage_options' ) ) { wp_die( 'Unauthorized' ); }

        $settings      = $this->get_settings();
        $redirects     = array();
        $raw_redirects = json_decode( stripslashes( $_POST['redirects'] ?? '[]' ), true );

        if ( is_array( $raw_redirects ) ) {
            foreach ( $raw_redirects as $r ) {
                $from = sanitize_text_field( $r['from'] ?? '' );
                $to   = sanitize_text_field( $r['to']   ?? '' );
                // Skip empty or self-referencing entries
                if ( empty( $from ) || empty( $to ) ) {
                    continue;
                }
                $redirects[] = array(
                    'id'    => sanitize_text_field( $r['id'] ?? ( 'redir_' . uniqid() ) ),
                    'label' => sanitize_text_field( $r['label'] ?? '' ),
                    'from'  => $from,
                    'to'    => $to,
                    'type'  => in_array( $r['type'] ?? '', array( '301', '302' ) ) ? $r['type'] : '301',
                );
            }
        }

        $settings['redirects'] = $redirects;
        update_option( $this->option_name, $settings );
        wp_send_json_success( array( 'message' => 'Page redirects saved.' ) );
    }

    // ─── AJAX: CLEAR LOG ─────────────────────────────────────────────────────────

    public function ajax_clear_log() {
        check_ajax_referer( 's404r_nonce', 'nonce' );
        if ( ! current_user_can( 'manage_options' ) ) { wp_die( 'Unauthorized' ); }

        $settings        = $this->get_settings();
        $settings['log'] = array();
        update_option( $this->option_name, $settings );
        wp_send_json_success();
    }
    
// ─── AJAX: EXPORT LOG AS CSV ─────────────────────────────
public function ajax_export_log_csv() {
    check_ajax_referer( 's404r_nonce', 'nonce' );

    if ( ! current_user_can( 'manage_options' ) ) {
        wp_send_json_error( array( 'message' => 'Unauthorized' ), 403 );
    }

    $settings = $this->get_settings();
    $log      = isset( $settings['log'] ) ? $settings['log'] : array();

    if ( empty( $log ) ) {
        wp_send_json_error( array( 'message' => 'No log entries found.' ) );
    }

    // Build CSV
    $output = fopen('php://temp', 'r+');
    fputcsv($output, array('Time', 'From URL', 'To URL', 'Rule / Label'));

    foreach($log as $entry){
        fputcsv($output, array(
            $entry['time'] ?? '',
            $entry['from'] ?? '',
            $entry['to']   ?? '',
            $entry['rule'] ?? '',
        ));
    }

    rewind($output);
    $csv_content = stream_get_contents($output);
    fclose($output);

    wp_send_json_success(array(
        'filename' => 'smart404-log-' . date('Y-m-d') . '.csv',
        'content'  => base64_encode($csv_content),
    ));
}

    // ─── PUBLIC API ──────────────────────────────────────────────────────────────

    /**
     * Returns the admin URL for this plugin's settings page.
     * Useful for Master_Plugin integrations or any external link.
     *
     * @return string
     */
    public function get_admin_url() {
        return admin_url( 'admin.php?page=' . $this->menu_slug );
    }

    /**
     * Renders the plugin settings page.
     * Called directly by Master_Plugin::register_admin_page() when it needs
     * to display this plugin's UI inside a master panel.
     */
    public function render_page() {
        $this->render_settings_page();
    }
}

Smart404Redirect::get_instance();

// ─── PUBLIC HELPER FUNCTION ───────────────────────────────────────────────────

/**
 * Renders the Smart 404 Redirect admin page.
 *
 * Usage in a master plugin:
 *
 *   Master_Plugin::register_admin_page( 'custom-url-redirect-manager', function() {
 *       curm_admin_page();
 *   } );
 *
 * This function is intentionally kept outside the class so that Master_Plugin
 * callbacks don't need to know about the singleton pattern.
 */
function curm_admin_page() {
    $instance = Smart404Redirect::get_instance();

    // Ensure scripts / styles are enqueued even when rendered inside a master panel.
    // WordPress will deduplicate if they were already enqueued normally.
    if ( ! wp_script_is( 's404r-admin', 'enqueued' ) ) {
        wp_enqueue_style(
            's404r-admin',
            S404R_PLUGIN_URL . 'assets/admin.css',
            array(),
            S404R_VERSION
        );
        wp_enqueue_script(
            's404r-admin',
            S404R_PLUGIN_URL . 'assets/admin.js',
            array( 'jquery' ),
            S404R_VERSION,
            true
        );
        wp_localize_script( 's404r-admin', 'S404R', array(
            'nonce'    => wp_create_nonce( 's404r_nonce' ),
            'ajax_url' => admin_url( 'admin-ajax.php' ),
            'settings' => $instance->get_settings(),
            'pages'    => $instance->get_pages_list_public(),
        ) );
    }

    $instance->render_page();
}

// ─── MASTER PLUGIN INTEGRATION ────────────────────────────────────────────────

/**
 * Registers this plugin's settings page with a Master_Plugin if one is present.
 *
 * Master_Plugin::register_admin_page() is expected to accept:
 *   - string   $slug     Unique identifier for the page within the master panel
 *   - callable $callback A zero-argument callable that renders the page HTML
 *
 * The integration is wrapped in a check so the plugin remains fully functional
 * even when Master_Plugin is not installed.
 */
add_action( 'plugins_loaded', function () {
    if ( class_exists( 'Master_Plugin' ) && method_exists( 'Master_Plugin', 'register_admin_page' ) ) {
        Master_Plugin::register_admin_page(
            'custom-url-redirect-manager',
            function () {
                curm_admin_page();
            }
        );
    }
}, 20 );
