class Solution {
    int MOD = 20170805;
    public int solution(int m, int n, int[][] cityMap) {
        int[][] row = new int[m][n];
        int[][] col = new int[m][n];
        for(int i = 0; i < m ; i++)
        {
            if(cityMap[i][0]==0){
                row[i][0] = 1;
                col[i][0] = 1;
            }
             else if(cityMap[i][0]==2){
                row[i][0] = 1;
                col[i][0] = 0;
            }
            else{
                break;
            }
        }
        for(int i = 0; i < n ; i++)
        {
            if(cityMap[0][i]==0){
                col[0][i] = 1;
                row[0][i] = 1;
            }
            else if(cityMap[0][i]==2){
                col[0][i] = 1;
                row[0][i] = 0;
            }
            else{
                break;
            }
        }
        for(int i = 1; i<n;i++)
        {
            for(int j =1; j<m; j++){
            if(cityMap[j][i]==1){
                row[j][i] =0;
                col[j][i] =0;
                 }
            else if(cityMap[j][i]==2){
                row[j][i] = row[j-1][i];
                col[j][i] = col[j][i-1];
            }
            else{
                row[j][i] = (row[j-1][i]+col[j][i-1]) % MOD;
                col[j][i] = (row[j-1][i]+col[j][i-1]) % MOD;
            }
            }
        }
        
        int answer = 0;
            answer = (row[m-2][n-1] + col[m-1][n-2]) % MOD;
        return answer;
    }
}