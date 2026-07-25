class Solution {
    public int romanToInt(String s) {
        int n = s.length();

        int sum = 0;

        for(int i = 0; i < n; i++){
            char c = s.charAt(i);

            switch(c){
                case 'I':{
                    if(i+1 < n && s.charAt(i+1) == 'V'){
                        sum += 4;
                        i++;
                        break;
                    }
                    if(i+1 < n && s.charAt(i+1) == 'X'){
                        sum += 9;
                        i++;
                        break;
                    }
                    sum += 1;
                } break;
                case 'V':{
                    sum += 5;

                }break;
                case 'X':{
                    if(i+1 < n && s.charAt(i+1) == 'L'){
                        sum += 40;
                        i++;
                        break;
                    }
                    if(i+1 < n && s.charAt(i+1) == 'C'){
                        sum += 90;
                        i++;
                        break;
                    }
                    sum += 10;
                }break;
                case 'L':{
                    sum += 50;
                }break;
                case 'C':{
                    if(i+1 < n && s.charAt(i+1) == 'D'){
                        sum += 400;
                        i++;
                        break;
                    }
                    if(i+1 < n && s.charAt(i+1) == 'M'){
                        sum += 900;
                        i++;
                        break;
                    }
                    sum += 100;
                }break;
                case 'D':{
                    sum += 500;
                }break;
                case 'M':{
                    sum += 1000;
                }break;
            }
        }
        return sum;
    }
}