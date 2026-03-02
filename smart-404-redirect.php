<?php
/**
 * Plugin Name: Smart 404 Redirect
 * Description: Intelligently redirect 404 errors to custom pages with post-type pattern matching.
 * Version: 1.2.0
 * Author: Tajwar Tajim
 * License: GPL v2 or later
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'S404R_VERSION', '1.2.0' );
define( 'S404R_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'S404R_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

class Smart404Redirect {

    private static $instance = null;
    private $option_name = 'smart_404_redirect_settings';

    public static function get_instance() {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action( 'admin_menu', array( $this, 'add_admin_menu' ) );
        add_action( 'admin_init', array( $this, 'register_settings' ) );
        add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_scripts' ) );
        add_action( 'template_redirect', array( $this, 'handle_404' ), 1 );
        add_action( 'wp_ajax_s404r_save_rules', array( $this, 'ajax_save_rules' ) );
        add_action( 'wp_ajax_s404r_delete_rule', array( $this, 'ajax_delete_rule' ) );
        add_action( 'wp_ajax_s404r_save_general', array( $this, 'ajax_save_general' ) );
        add_action( 'wp_ajax_s404r_clear_log', array( $this, 'ajax_clear_log' ) );
        register_activation_hook( __FILE__, array( $this, 'activate' ) );
    }

    public function activate() {
        $defaults = array(
            'default_redirect' => '',
            'redirect_type'    => '301',
            'rules'            => array(),
            'logging_enabled'  => false,
            'log'              => array(),
        );
        if ( ! get_option( $this->option_name ) ) {
            add_option( $this->option_name, $defaults );
        }
    }

    public function get_settings() {
        return get_option( $this->option_name, array(
            'default_redirect' => '',
            'redirect_type'    => '301',
            'rules'            => array(),
            'logging_enabled'  => false,
            'log'              => array(),
        ) );
    }

    public function handle_404() {
        if ( ! is_404() ) {
            return;
        }

        $settings     = $this->get_settings();
        $current_url  = trim( parse_url( $_SERVER['REQUEST_URI'], PHP_URL_PATH ), '/' );
        $redirect_url = '';
        $matched_rule = null;

        // Check pattern-based rules first (most specific wins)
        if ( ! empty( $settings['rules'] ) ) {
            foreach ( $settings['rules'] as $rule ) {
                if ( empty( $rule['pattern'] ) || empty( $rule['redirect_to'] ) ) {
                    continue;
                }
                $pattern = trim( $rule['pattern'], '/' );
                // Convert wildcard pattern to regex
                $regex = '#^' . str_replace( '\*', '.*', preg_quote( $pattern, '#' ) ) . '$#i';
                if ( preg_match( $regex, $current_url ) ) {
                    $redirect_url = $rule['redirect_to'];
                    $matched_rule = $rule;
                    break;
                }
            }
        }

        // Fall back to default redirect
        if ( empty( $redirect_url ) && ! empty( $settings['default_redirect'] ) ) {
            $redirect_url = $settings['default_redirect'];
        }

        if ( empty( $redirect_url ) ) {
            return;
        }

        // Log if enabled
        if ( ! empty( $settings['logging_enabled'] ) ) {
            $this->log_redirect( $current_url, $redirect_url, $matched_rule );
        }

        // Build full URL if relative
        if ( strpos( $redirect_url, 'http' ) !== 0 ) {
            $redirect_url = home_url( '/' . ltrim( $redirect_url, '/' ) );
        }

        $redirect_type = isset( $settings['redirect_type'] ) ? intval( $settings['redirect_type'] ) : 301;
        wp_redirect( $redirect_url, $redirect_type );
        exit;
    }

    private function log_redirect( $from, $to, $rule = null ) {
        $settings = $this->get_settings();
        $log      = isset( $settings['log'] ) ? $settings['log'] : array();
        array_unshift( $log, array(
            'time'    => current_time( 'mysql' ),
            'from'    => $from,
            'to'      => $to,
            'rule'    => $rule ? $rule['label'] : 'Default',
        ) );
        // Keep only last 100 entries
        $log = array_slice( $log, 0, 100 );
        $settings['log'] = $log;
        update_option( $this->option_name, $settings );
    }

    public function add_admin_menu() {
        add_options_page(
            'Smart 404 Redirect',
            'Smart 404 Redirect',
            'manage_options',
            'smart-404-redirect',
            array( $this, 'render_settings_page' )
        );
    }

    public function register_settings() {
        // No sanitize_callback — all saving goes through AJAX handlers which
        // sanitize their own input. A sanitize_callback fires on every
        // update_option() call (including AJAX saves) and was overwriting rules.
        register_setting( 'smart_404_redirect_group', $this->option_name );
    }

    public function ajax_save_rules() {
        check_ajax_referer( 's404r_nonce', 'nonce' );
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( 'Unauthorized' );
        }

        $settings = $this->get_settings();
        $rules    = array();

        if ( ! empty( $_POST['rules'] ) ) {
            $raw_rules = json_decode( stripslashes( $_POST['rules'] ), true );
            if ( is_array( $raw_rules ) ) {
                foreach ( $raw_rules as $rule ) {
                    $rules[] = array(
                        'id'          => sanitize_text_field( $rule['id'] ),
                        'label'       => sanitize_text_field( $rule['label'] ),
                        'pattern'     => sanitize_text_field( $rule['pattern'] ),
                        'redirect_to' => sanitize_text_field( $rule['redirect_to'] ),
                        'type'        => in_array( $rule['type'], array( '301', '302' ) ) ? $rule['type'] : '301',
                    );
                }
            }
        }

        $settings['rules'] = $rules;
        update_option( $this->option_name, $settings );
        wp_send_json_success( array( 'message' => 'Rules saved successfully.' ) );
    }

    public function ajax_delete_rule() {
        check_ajax_referer( 's404r_nonce', 'nonce' );
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( 'Unauthorized' );
        }
        $rule_id  = sanitize_text_field( $_POST['rule_id'] );
        $settings = $this->get_settings();
        $settings['rules'] = array_values( array_filter( $settings['rules'], function( $r ) use ( $rule_id ) {
            return $r['id'] !== $rule_id;
        } ) );
        update_option( $this->option_name, $settings );
        wp_send_json_success();
    }

    public function enqueue_admin_scripts( $hook ) {
        if ( 'settings_page_smart-404-redirect' !== $hook ) {
            return;
        }
        wp_enqueue_style( 's404r-admin', S404R_PLUGIN_URL . 'assets/admin.css', array(), S404R_VERSION );
        wp_enqueue_script( 's404r-admin', S404R_PLUGIN_URL . 'assets/admin.js', array( 'jquery' ), S404R_VERSION, true );
        wp_localize_script( 's404r-admin', 'S404R', array(
            'nonce'    => wp_create_nonce( 's404r_nonce' ),
            'ajax_url' => admin_url( 'admin-ajax.php' ),
            'settings' => $this->get_settings(),
            'pages'    => $this->get_pages_list(),
        ) );
    }

    private function get_pages_list() {
        $pages  = get_pages( array( 'post_status' => 'publish' ) );
        $result = array();
        foreach ( $pages as $page ) {
            $result[] = array(
                'id'    => $page->ID,
                'title' => $page->post_title,
                'url'   => get_permalink( $page->ID ),
                'slug'  => '/' . get_page_uri( $page->ID ),
            );
        }
        return $result;
    }

    public function render_settings_page() {
        ?>
        <div id="s404r-app"></div>
        <?php
    }
    public function ajax_save_general() {
        check_ajax_referer( 's404r_nonce', 'nonce' );
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( 'Unauthorized' );
        }
        $settings = $this->get_settings();
        $settings['default_redirect'] = sanitize_text_field( $_POST['default_redirect'] );
        $settings['redirect_type']    = in_array( $_POST['redirect_type'], array( '301', '302' ) ) ? $_POST['redirect_type'] : '301';
        $settings['logging_enabled']  = ! empty( $_POST['logging_enabled'] ) && $_POST['logging_enabled'] === '1';
        update_option( $this->option_name, $settings );
        wp_send_json_success( array( 'message' => 'General settings saved.' ) );
    }

    public function ajax_clear_log() {
        check_ajax_referer( 's404r_nonce', 'nonce' );
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( 'Unauthorized' );
        }
        $settings        = $this->get_settings();
        $settings['log'] = array();
        update_option( $this->option_name, $settings );
        wp_send_json_success();
    }
}

Smart404Redirect::get_instance();
