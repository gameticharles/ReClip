using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SQLite;
using System.IO;
using System.Text;
using System.Windows.Forms;

namespace Clipboard__.Functions
{

    public class EntryList
    {
        public EntryList()
        {
            ColumnName = new List<string>();
            DbType = new List<DbType>();
            Content = new List<object>();
        }

        public List<string> ColumnName { set; get; }

        public List<DbType> DbType { set; get; }

        public List<object> Content { set; get; }


    }

    public class ListWithName
    {
        public ListWithName()
        {
            SubItems = new List<object>();
        }

        public string Text { set; get; }

        public List<object> SubItems { set; get; }
    }

    /// <summary>
    /// Class to access the column properties
    /// </summary>
    public class ColumnProperties
    {
        public string ID { get; set; }
        public string Name { get; set; }
        public string DataType { get; set; }
        public string Content { get; set; }
        public bool AllowNull { get; set; }
    }

    /// <summary>
    /// Column Properties and functions
    /// </summary>
    public class Column : IEnumerable<ColumnProperties>
    {
        public Column()
        {
            cols = new List<ColumnProperties>();
        }
        private List<ColumnProperties> cols = new List<ColumnProperties>();

        public IEnumerator<ColumnProperties> GetEnumerator()
        {
            return this.cols.GetEnumerator();
        }
        System.Collections.IEnumerator System.Collections.IEnumerable.GetEnumerator()
        {
            return GetEnumerator();
        }

        /// <summary>
        /// Add Column and parse name only with default params
        /// </summary>
        /// <param name="Name"></param>
        public void Add(string Name)
        {
            ColumnProperties ml = new ColumnProperties();
            ml.Name = Name;
            ml.DataType = "VARCHAR";
            ml.AllowNull = true;
            cols.Add(ml);
        }

        /// <summary>
        /// Add column or field and parse Name and Data type. Nullable is true
        /// </summary>
        /// <param name="Name">Column or field name</param>
        /// <param name="DataType">Data type</param>
        public void Add(string Name, string DataType)
        {
            ColumnProperties ml = new ColumnProperties();
            ml.Name = Name;
            ml.DataType = DataType;
            ml.AllowNull = true;
            cols.Add(ml);
        }

        /// <summary>
        /// Add column or field and parse Name, Data type and if nullable
        /// </summary>
        /// <param name="Name">Column or field name</param>
        /// <param name="DataType">Data type</param>
        /// <param name="AllowNulls">Is nullable</param>
        public void Add(string Name, string DataType, bool AllowNulls)
        {
            ColumnProperties ml = new ColumnProperties();
            ml.Name = Name;
            ml.DataType = DataType;
            ml.AllowNull = AllowNulls;
            cols.Add(ml);
        }

        /// <summary>
        /// Add a column with all params
        /// </summary>
        /// <param name="Name">Name of the column or field</param>
        /// <param name="DataType">Data type</param>
        /// <param name="AllowNulls">Is nullable</param>
        /// <param name="ID">Column or field ID</param>
        public void Add(string Name, string DataType, bool AllowNulls, string ID)
        {
            ColumnProperties ml = new ColumnProperties();
            ml.Name = Name;
            ml.DataType = DataType;
            ml.ID = ID;
            ml.AllowNull = AllowNulls;
            cols.Add(ml);
        }

        /// <summary>
        /// Count number of columns 
        /// </summary>
        public int Count
        {
            get { return cols.Count; }
        }

    }

    /// <summary>
    /// Create new table
    /// </summary>
    public class Table
    {
        public Table()
        {
            Columns = new Column();
        }

        public string Name { set; get; }

        public Column Columns { set; get; }

    }

    public class SQLiteHelper
    {
        SQLiteDataReader DataReader;

        public string DatabaseFile { set; get; }

        public string Password { set; get; }


        SQLiteConnection DataBaseConnnection = new SQLiteConnection();

        private void SetConnection()
        {
            
            if (DataBaseConnnection.State == System.Data.ConnectionState.Open)
            {
                DataBaseConnnection.Close();
            }
            
            if (Password != null)
            {
                DataBaseConnnection.ConnectionString = @"Data Source=" + DatabaseFile + "; Password=" + Password + ";";
                DataBaseConnnection.Open();
            }
            if (Password == null)
            {
                DataBaseConnnection.ConnectionString = @"Data Source=" + DatabaseFile + ";";
                DataBaseConnnection.Open();                    
            }
            
        }

        public void CreateDatabase()
        {           

            SQLiteConnection.CreateFile(DatabaseFile);           
            
            if (Password != null)
            {
                DataBaseConnnection.SetPassword(Password);
            }

            //SetConnection();
            
        }

        public void CreateTable(Table Table)
        {
            try
            {
                SetConnection();
                string firstLine = "CREATE TABLE IF NOT EXISTS [" + Table.Name + "] ([ID] INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, ";

                StringBuilder queryBuilder = new StringBuilder();
                queryBuilder.Append(firstLine);

                foreach (var item in Table.Columns)
                {
                    string nl = "";
                    if (item.AllowNull) nl = "NULL";
                    else nl = "NOT NULL";

                    queryBuilder.Append("[" + item.Name + "] " + item.DataType + " " + nl + ", ");
                }

                queryBuilder.Remove(queryBuilder.Length - 2, 2);
                queryBuilder.Append(")");
                SQLiteCommand sqliteCommand = new SQLiteCommand(queryBuilder.ToString(), DataBaseConnnection);
                sqliteCommand.ExecuteNonQuery();
                                
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error: " + ex.Message.ToString(), "Error", MessageBoxButtons.OK, MessageBoxIcon.Asterisk);
                
            }

        }

        public void CreateTable(string TableName, string[] ColumnNames, bool[] AllowNulls, DbType[] DbTypes)
        {
            TableName = RemoveSpecialCharacters(TableName);
            try
            {
                SetConnection();
                string firstLine = "CREATE TABLE IF NOT EXISTS [" + TableName + "] ([ID] INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, ";
                StringBuilder queryBuilder = new StringBuilder();
                queryBuilder.Append(firstLine);
                for (int i = 0; i < ColumnNames.Length; i++)
                {
                    string nl = "";
                    if (AllowNulls[i]) nl = "NULL";
                    else nl = "NOT NULL";

                    queryBuilder.Append("[" + ColumnNames[i] + "] " + DbTypes[i] + " " + nl + ", ");

                }
                queryBuilder.Remove(queryBuilder.Length - 2, 2);
                queryBuilder.Append(")");
                SQLiteCommand sqliteCommand = new SQLiteCommand(queryBuilder.ToString(), DataBaseConnnection);
                sqliteCommand.ExecuteNonQuery();
                DataBaseConnnection.Close();
               
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error: " + ex.Message.ToString(), "Error", MessageBoxButtons.OK, MessageBoxIcon.Asterisk);
                
            }

        }

        public void DeleteTable(string TableName)
        {
            try
            {
                SetConnection();
                SQLiteCommand sqliteCommand = new SQLiteCommand("DROP TABLE IF EXISTS " + TableName, DataBaseConnnection);
                sqliteCommand.ExecuteNonQuery();
                SQLiteCommand VacuumCommand = new SQLiteCommand("vacuum;", DataBaseConnnection);
                VacuumCommand.ExecuteNonQuery();
                DataBaseConnnection.Close();
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error: " + ex.Message.ToString(), "Error", MessageBoxButtons.OK, MessageBoxIcon.Asterisk);
                //frmPassword fp = new frmPassword();
                //if (fp.ShowDialog() == DialogResult.OK)
                //{
                //    Password = fp.txtPass.Text;
                //    DeleteTable(TableName);
                //}
                //Password = null;
                DeleteTable(TableName);
            }

        }

        public List<string> GetTableNames()
        {
            List<string> tables = new List<string>();
            try
            {
                SetConnection();
                SQLiteCommand sqliteCommand = new SQLiteCommand("SELECT NAME FROM sqlite_master WHERE TYPE='table' ORDER BY NAME", DataBaseConnnection);
                DataReader = sqliteCommand.ExecuteReader();
                while (DataReader.Read())
                {
                    if (DataReader.HasRows)
                    {
                        tables.Add(DataReader[0].ToString());
                    }
                }
                DataBaseConnnection.Close();

            }
            catch (Exception ex)
            {
                MessageBox.Show("Error: " + ex.Message.ToString(), "Error", MessageBoxButtons.OK, MessageBoxIcon.Asterisk);
            }
            return tables;
        }

        public Column GetColumnsFromTableName(string TableName)
        {
            TableName = RemoveSpecialCharacters(TableName);
            Column cols = new Column();
            try
            {
                SetConnection();
                SQLiteCommand sqliteCommand = new SQLiteCommand("PRAGMA table_info('" + TableName + "');", DataBaseConnnection);
                DataReader = sqliteCommand.ExecuteReader();
                while (DataReader.Read())
                {
                    ColumnProperties ml = new ColumnProperties();
                    ml.ID = DataReader[0].ToString();
                    ml.Name = DataReader[1].ToString();
                    ml.DataType = DataReader[2].ToString();
                    bool nl = false;
                    if (DataReader[3].ToString() == "0") nl = true;
                    if (DataReader[3].ToString() == "1") nl = false;
                    ml.AllowNull = nl;
                    cols.Add(DataReader[1].ToString(), DataReader[2].ToString(), nl, DataReader[0].ToString());
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error: " + ex.Message.ToString(), "Error", MessageBoxButtons.OK, MessageBoxIcon.Asterisk);
            }
            return cols;

        }

        public void CreateEntry(string TableName, EntryList EntryList)
        {
            TableName = RemoveSpecialCharacters(TableName);
            try
            {
                SetConnection();
                StringBuilder queryBuilder = new StringBuilder();
                queryBuilder.Append("insert into " + TableName + " (");
                foreach (var item in EntryList.ColumnName)
                {
                    queryBuilder.Append(item + ", ");
                }
                queryBuilder.Remove(queryBuilder.Length - 2, 2);
                queryBuilder.Append(")");
                queryBuilder.Append(" values (");
                foreach (var item in EntryList.ColumnName)
                {
                    queryBuilder.Append("@" + item + ", ");
                }
                queryBuilder.Remove(queryBuilder.Length - 2, 2);
                queryBuilder.Append(")");
                SQLiteCommand sqliteCommand = new SQLiteCommand(queryBuilder.ToString(), DataBaseConnnection);

                for (int i = 0; i < EntryList.ColumnName.Count; i++)
                {
                    sqliteCommand.Parameters.Add("@" + EntryList.ColumnName[i], EntryList.DbType[i]).Value = EntryList.Content[i];
                }
                sqliteCommand.ExecuteNonQuery();
                DataBaseConnnection.Close();
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error: " + ex.Message.ToString(), "Error", MessageBoxButtons.OK, MessageBoxIcon.Asterisk);
            }
        }

        public void CreateEntry(string TableName, object[] Content)
        {
            TableName = RemoveSpecialCharacters(TableName);
            try
            {
                SetConnection();
                StringBuilder queryBuilder = new StringBuilder();
                queryBuilder.Append("insert into " + TableName + " (");
                foreach (var item in GetColumnsFromTableName(TableName))
                {
                    queryBuilder.Append(item.Name + ", ");
                }
                queryBuilder.Remove(queryBuilder.Length - 2, 2);
                queryBuilder.Append(")");
                queryBuilder.Append(" values (");
                foreach (var item in GetColumnsFromTableName(TableName))
                {
                    queryBuilder.Append("@" + item.Name + ", ");
                }
                queryBuilder.Remove(queryBuilder.Length - 2, 2);
                queryBuilder.Append(")");
                SQLiteCommand sqliteCommand = new SQLiteCommand(queryBuilder.ToString(), DataBaseConnnection);
                List<string> colsNames = new List<string>();
                foreach (var item in GetColumnsFromTableName(TableName))
                {
                    colsNames.Add(item.Name);
                }

                for (int i = 0; i < GetColumnsFromTableName(TableName).Count; i++)
                {
                    sqliteCommand.Parameters.Add("@" + colsNames[i], DbType.Object).Value = Content[i];
                }
                sqliteCommand.ExecuteNonQuery();
                DataBaseConnnection.Close();
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error: " + ex.Message.ToString(), "Error", MessageBoxButtons.OK, MessageBoxIcon.Asterisk);
            }
        }

        public void DeleteEntry(string TableName, string ColumnName, string Equals)
        {
            TableName = RemoveSpecialCharacters(TableName);
            ColumnName = RemoveSpecialCharacters(ColumnName);
            //Equals = RemoveSpecialCharacters(Equals);
            try
            {
                SetConnection();
                SQLiteCommand sqliteCommand = new SQLiteCommand("DELETE FROM " + TableName + " WHERE " + ColumnName + "=@" + ColumnName, DataBaseConnnection);
                sqliteCommand.Parameters.Add("@" + ColumnName, DbType.Object).Value = Equals;
                sqliteCommand.ExecuteNonQuery();
                SQLiteCommand VacuumCommand = new SQLiteCommand("vacuum;", DataBaseConnnection);
                VacuumCommand.ExecuteNonQuery();
                DataBaseConnnection.Close();
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error: " + ex.Message.ToString(), "Error", MessageBoxButtons.OK, MessageBoxIcon.Asterisk);
            }
        }

        public void UpdateEntry(string TableName, EntryList EntryList, string ColumnName, string Equals)
        {
            TableName = RemoveSpecialCharacters(TableName);
            ColumnName = RemoveSpecialCharacters(ColumnName);
            Equals = RemoveSpecialCharacters(Equals);

            try
            {
                SetConnection();
                StringBuilder queryBuilder = new StringBuilder();
                queryBuilder.Append("update " + TableName + " set ");
                foreach (var item in EntryList.ColumnName)
                {
                    queryBuilder.Append(item + "=@" + item + ", ");
                }
                queryBuilder.Remove(queryBuilder.Length - 2, 2);
                queryBuilder.Append(" ");
                queryBuilder.Append(" WHERE " + ColumnName + "='" + Equals + "'");
                SQLiteCommand sqliteCommand = new SQLiteCommand(queryBuilder.ToString(), DataBaseConnnection);

                for (int i = 0; i < EntryList.ColumnName.Count; i++)
                {
                    sqliteCommand.Parameters.Add("@" + EntryList.ColumnName[i], EntryList.DbType[i]).Value = EntryList.Content[i];
                }
                sqliteCommand.ExecuteNonQuery();
                DataBaseConnnection.Close();
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error: " + ex.Message.ToString(), "Error", MessageBoxButtons.OK, MessageBoxIcon.Asterisk);
            }

        }

        public List<ListWithName> GetEntries(string TableName)
        {
            TableName = RemoveSpecialCharacters(TableName);

            List<ListWithName> listLvi = new List<ListWithName>();
            try
            {
               
                SetConnection();
                
                SQLiteCommand sqliteCommand = new SQLiteCommand("select * from " + TableName, DataBaseConnnection);
                
                DataReader = sqliteCommand.ExecuteReader();
                
                while (DataReader.Read())
                {
                    ListWithName lwn = new ListWithName();
                    lwn.Text = DataReader[0].ToString();
                    for (int i = 1; i < DataReader.FieldCount; i++)
                    {
                        lwn.SubItems.Add(DataReader[i]);
                    }
                    listLvi.Add(lwn);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error: " + ex.Message.ToString(), "Error", MessageBoxButtons.OK, MessageBoxIcon.Asterisk);
            }

            return listLvi;
        }

        public List<ListWithName> SearchDatabase(string ColumnName, string SearchKeyWord)
        {
            ColumnName = RemoveSpecialCharacters(ColumnName);
            SearchKeyWord = RemoveSpecialCharacters(SearchKeyWord);
            List<ListWithName> listLwn = new List<ListWithName>();
            try
            {
                foreach (var table in GetTableNames())
                {
                    if (table != "sqlite_sequence")
                    {
                        SetConnection();
                        SQLiteCommand sqliteCommand = new SQLiteCommand("SELECT * FROM " + table + " WHERE " + ColumnName + " LIKE @searchKey", DataBaseConnnection);
                        sqliteCommand.Parameters.Add("@searchKey", DbType.String).Value = "%" + SearchKeyWord + "%";
                        DataReader = sqliteCommand.ExecuteReader();
                        if (DataReader.HasRows)
                        {
                            while (DataReader.Read())
                            {
                                ListWithName lwn = new ListWithName();
                                lwn.Text = DataReader[0].ToString();
                                for (int i = 1; i < DataReader.FieldCount; i++)
                                {
                                    lwn.SubItems.Add(DataReader[i].ToString());
                                }
                                listLwn.Add(lwn);
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error: " + ex.Message.ToString(), "Error", MessageBoxButtons.OK, MessageBoxIcon.Asterisk);
            }
            return listLwn;
        }

        public List<ListWithName> SearchDatabase(string SearchKeyWord)
        {
            SearchKeyWord = RemoveSpecialCharacters(SearchKeyWord);
            List<ListWithName> listLwn = new List<ListWithName>();
            try
            {
                foreach (var table in GetTableNames())
                {
                    foreach (var col in GetColumnsFromTableName(table))
                    {
                        if (table != "sqlite_sequence")
                        {
                            SetConnection();
                            SQLiteCommand sqliteCommand = new SQLiteCommand("SELECT * FROM " + table + " WHERE " + col.Name + " LIKE @searchKey", DataBaseConnnection);
                            sqliteCommand.Parameters.Add("@searchKey", DbType.String).Value = "%" + SearchKeyWord + "%"; ;
                            DataReader = sqliteCommand.ExecuteReader();
                            if (DataReader.HasRows)
                            {
                                while (DataReader.Read())
                                {
                                    ListWithName lwn = new ListWithName();
                                    lwn.Text = DataReader[0].ToString();
                                    for (int i = 1; i < DataReader.FieldCount; i++)
                                    {
                                        lwn.SubItems.Add(DataReader[i].ToString());
                                    }
                                    listLwn.Add(lwn);
                                }
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error: " + ex.Message.ToString(), "Error", MessageBoxButtons.OK, MessageBoxIcon.Asterisk);
            }
            return listLwn;
        }

        public static string RemoveSpecialCharacters(string str)
        {
            StringBuilder sb = new StringBuilder();
            foreach (char c in str)
            {
                if ((c >= '0' && c <= '9') || (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || c == '.' || c == '_')
                {
                    sb.Append(c);
                }
            }
            return sb.ToString();
        }

    }
}

