class Solution {
    public int[] solution(int[] num_list) {
        int even_cnt = 0;
        int odd_cnt = 0; 
        
        for (int i = 0; i < num_list.length; i++){
            if (num_list[i] % 2 == 0){
               even_cnt++;  
            } else {
                odd_cnt++; 
            }
        }
        return new int[] {even_cnt, odd_cnt};
    }
}