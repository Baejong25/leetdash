class Solution {
    public int solution(int[][] sizes) {

        int n = sizes.length;

        int wmax = 0;
        int hmax = 0;

        for(int i = 0; i < n; i++){
            int w;
            int h;

            if(sizes[i][0] > sizes[i][1]){
                w = sizes[i][0];
                h = sizes[i][1];
            } else{
                w = sizes[i][1];
                h = sizes[i][0];
            }

            if(w > wmax){
                wmax = w;
            }
            if(h > hmax){
                hmax = h;
            }
        }


        int answer = wmax * hmax;
        return answer;
    }
}