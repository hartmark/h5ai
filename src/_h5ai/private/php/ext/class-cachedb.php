<?php

class CacheDB {
    /* Wrapper around SQLite3 DB to cache failed archive file parsing attempts. */
    private $setup;
    private $conn;
    private $version;
    private $sel_stmt;
    private $ins_stmt;

    public function __construct($setup) {
        $this->setup = $setup;
        $this->create($setup->get('CACHE_PRV_PATH') . '/thumbs_cache.db');
        $this->setup_version();
    }

    public function __destruct() {
        if (isset($this->conn)) {
            $this->conn->close();
        }
    }

    public function create($path) {
        if (!extension_loaded('sqlite3')) {
            error_log("H5AI warning: sqlite3 module not found.");
            $this->conn = null;
            return;
        }
        if (file_exists($path)) {
            $this->conn = new SQLite3($path);
            return;
        }
        // FIXME use IF NOT EXIST to avoid checking with file_exists?
        $db = new SQLite3($path);
        if ($db->exec('CREATE TABLE archives
(hashedp TEXT NOT NULL UNIQUE,
type TEXT,
error INT,
version INT,
PRIMARY KEY("hashedp")
);')) {
        $this->conn = $db;
        }
    }

    public function insert($hash, $type, $error) {
        if (!$this->conn) {
            return;
        }
        if (!$this->ins_stmt) {
            $this->ins_stmt = $this->conn->prepare(
'INSERT OR REPLACE INTO archives VALUES (:id, :type, :err, :ver);');
        }
        $stmt = $this->ins_stmt;
        $stmt->reset();
        $stmt->bindValue(':id', $hash, SQLITE3_TEXT);
        $stmt->bindValue(':type', $type, SQLITE3_TEXT);
        $stmt->bindValue(':err', $error, SQLITE3_INTEGER);
        $stmt->bindValue(':ver', $this->version, SQLITE3_INTEGER);
//         $stmt = 'INSERT OR REPLACE INTO archives VALUES
// (\''. $hash . '\',\'' . $error . '\',\'' . $this->version . '\')';
        // $this->conn->exec($stmt);
        $stmt->execute();
    }

    public function has_result($hash) {
        if (!$this->conn) {
            return [];
        }
        if (!$this->sel_stmt) {
            $this->sel_stmt = $this->conn->prepare(
                'SELECT version FROM archives WHERE hashedp = :id;');
        }
        $stmt = $this->sel_stmt;
        $stmt->reset();
        $stmt->bindValue(':id', $hash, SQLITE3_TEXT);
        $res = $stmt->execute();

        // $res = $this->conn->query('SELECT version FROM archives where hashedp = \'' . $hash . '\';');

        $row = $res->fetchArray();

        if ($row) {
            Util::write_log("FOUND ROW for $hash");
        } else {
            Util::write_log("NO ROW for $hash");
        }

        return $row ? !$this->updated_handlers($row) : $row;
    }

    public function updated_handlers($row) {
        /* Return if the handlers have been updated since last failure check. */
        Util::write_log("DUMP version: " . $row['version']);
        return $this->version !== $row['version'];
    }

    public function setup_version() {
        /* Returns an integer representing the available archive handlers
           at the time of failure. */
        $hash = 0;
        $hash |= $this->setup->get('HAS_PHP_ZIP') ? 0b0001 : 0;
        $hash |= $this->setup->get('HAS_PHP_RAR') ? 0b0010 : 0;
        $this->version = $hash;
        return $hash;
    }
}
