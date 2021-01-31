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
        $this->create_type_table($db);
        $db->exec('CREATE TABLE archives
 (hashedp TEXT NOT NULL UNIQUE PRIMARY KEY,
 typeid INTEGER,
 error INTEGER,
 version INTEGER,
 FOREIGN KEY(typeid) REFERENCES types(id)
 ) WITHOUT ROWID;');
        // FIXME DEBUG
        chmod($path, 0777);
        $this->conn = $db;
    }

    public function create_type_table($db) {
        $db->exec('CREATE TABLE types
(id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
type TEXT UNIQUE);');

        foreach (Util::AVAILABLE_TYPES as $type) {
            $db->exec('INSERT OR IGNORE INTO types VALUES (NULL, \''. $type .'\')');
        }
    }

    public function insert($hash, $type, $error) {
        if (!$this->conn) {
            return;
        }
        if (!$this->ins_stmt) {
            $this->ins_stmt = $this->conn->prepare(
'INSERT OR REPLACE INTO archives VALUES (:id, :typeid, :err, :ver);');
        }
        $stmt = $this->ins_stmt;
        $stmt->reset();
        $stmt->bindValue(':id', $hash, SQLITE3_TEXT);

        $typeid = $this->conn->querySingle('SELECT id FROM types WHERE type = \''. $type .'\';');
        if (!$typeid) {
            Util::write_log("Inserting new type: $type");
            $this->conn->exec('INSERT INTO types VALUES (NULL, \''. $type .'\')');
            $typeid = $this->conn->querySingle('SELECT id FROM types WHERE type = \''. $type .'\';');
        }
        $stmt->bindValue(':typeid', $typeid, SQLITE3_INTEGER);
        $stmt->bindValue(':err', $error, SQLITE3_INTEGER);
        $stmt->bindValue(':ver', $this->version, SQLITE3_INTEGER);
//         $stmt = 'INSERT OR REPLACE INTO archives VALUES
// (\''. $hash . '\',\'' . $error . '\',\'' . $this->version . '\')';
        // $this->conn->exec($stmt);
        $stmt->execute();
    }

    public function require_update($hash) {
        if (!$this->conn) {
            return [];
        }
        if (!$this->sel_stmt) {
            $this->sel_stmt = $this->conn->prepare(
                // 'SELECT version, type FROM archives WHERE hashedp = :id;');
                'SELECT archives.version, types.type
FROM archives, types
WHERE hashedp = :id
and archives.typeid = types.id;');
        }
        $stmt = $this->sel_stmt;
        $stmt->reset();
        $stmt->bindValue(':id', $hash, SQLITE3_TEXT);
        $res = $stmt->execute();

        // $res = $this->conn->querySingle('SELECT version FROM archives where hashedp = \'' . $hash . '\';', true);

        $row = $res->fetchArray(SQLITE3_ASSOC);
        // $res->finalize();

        if ($row) {
            Util::write_log("FOUND ROW for $hash: ". print_r($row, true));
        } else {
            Util::write_log("NO ROW for $hash");
        }

        if (!$row) {
            return false;
        }
        if ($this->updated_handlers($row)) {
            return true; // Force updating this entry
        }
        return $row['type'];
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
