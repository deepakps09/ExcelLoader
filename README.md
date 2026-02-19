excel file loader and formatter.

index page-
	the user is given two file input fields
 - source file : the excel file containing data in some format 
 - target template file : the excel file containing the proper headings / column names
 
 **select section**
 after selecting both files, the user will be given the choice for mapping. the left column lists those headers present in the target template file, and the right column contains dropdown lists and other options, for selecting columns from the source file
 if a column from the dropdown list is selected, only the cells under that column are mapped to the target column
 
 **merge**
 the merge option allows multiple columns to be selected, that is, the target columns' cells would contain the combination of data from each cells of the source columns. the user can also provide an optional delimiter, which defaults to an empty string if none are provided.
 
 **transform**
 the transform option allows string transformations to be applied to the data to be present in the target cell. transform rules are applied after merging the columns. multiple transform rules could be applied, and they would be executed in that order.
 
 **validation**
 validation option allows selecting rules to validate the data in the target cell. this is applied after merging and transforming. the cells which failed validation would be highlighted in red. multiple validation rules could be applied, and they would be executed in that order.
 
 **mapping section**
 mapping rules will be displayed on the right section.
 mapping rules can also be left blank. the column header would exist, but would be left blank, in the output file.
 
 **slice/select subset**
 Users are also provided with an option to slice/select subset. if this checkbox is ticked, the user can provide a range of rows to be included in the output. everything outside this range would be ignored.

